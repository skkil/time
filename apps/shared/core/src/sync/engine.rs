use std::time::Duration;

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use store_core::protocol::v1::{PullRequest, PullResponse, PushRequest, PushResponse};
use store_core::uuid::Uuid;
use store_core::{PullOutcome, PushOutcome, SyncStatus};

use super::issue::Issue;
use super::mutator::TimeMutator;
use super::upload;
use crate::calendar;
use crate::data::{ID_COLUMN, SYNCED_TABLES};
use crate::db;
use crate::env::LocalEnv;
use crate::error::{Error, Result};
use crate::mutations;

const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// What signing in to an account did with this device's data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SignIn {
    /// The device already belongs to this account.
    Synced,
    /// First sign-in: the device's rows are queued for upload.
    Uploading { rows: usize },
    /// The device holds another account's data; the user must choose
    /// [`Engine::keep_local`] or [`Engine::start_fresh`].
    OtherAccount { bound: Uuid },
}

/// The one sync facade every host uses (Tauri natively, the browser through
/// WASM, React Native through uniffi): time's database with store-core
/// installed, every write applied as a mutation and every read answered
/// from the local replica.
///
/// A device that never signed in writes directly with its own clock and
/// random ids: nothing could be pushed, so queueing would only grow the
/// queue. Its first sign-in uploads everything as one `importLocal`
/// mutation instead. From then on every write is captured, also while
/// signed out, and waits for the same account.
pub struct Engine {
    conn: Connection,
}

impl Engine {
    /// Migrates the database, installs store and registers every synced
    /// table, then finishes an upload a crash interrupted.
    pub fn open(conn: Connection) -> Result<Self> {
        conn.busy_timeout(BUSY_TIMEOUT)?;
        let mut engine = Self { conn };
        engine.refresh()?;
        Ok(engine)
    }

    /// Brings the database up to date again after its file was replaced
    /// (a restored backup): migrations, store and table registrations.
    pub fn refresh(&mut self) -> Result<()> {
        db::migrate(&mut self.conn)?;
        store_core::install(&self.conn)?;
        for table in SYNCED_TABLES {
            store_core::register_table(&self.conn, table, ID_COLUMN)?;
        }
        calendar::guard(&self.conn)?;
        store_core::set_product_schema_version(&self.conn, db::latest_version() as u32)?;
        upload::resume(&mut self.conn)?;
        Ok(())
    }

    pub fn in_memory() -> Result<Self> {
        Self::open(Connection::open_in_memory()?)
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    /// The account this device syncs with, once it signed in.
    pub fn scope(&self) -> Result<Option<Uuid>> {
        Ok(store_core::status(&self.conn)?.scope_id)
    }

    /// Applies a write command by its contract name.
    pub fn mutate(&mut self, name: &str, args: &Value) -> Result<Value> {
        if !mutations::is_mutation(name) {
            return Err(Error::invalid(format!("{name} isn't a mutation.")));
        }
        let Some(scope) = self.scope()? else {
            return mutations::apply_in_transaction(
                &mut self.conn,
                &LocalEnv::default(),
                name,
                args,
            );
        };
        let mutator = TimeMutator::for_scope(Some(scope));
        Ok(store_core::mutate(&mut self.conn, &mutator, name, args)?.value)
    }

    /// Answers a read command by its contract name.
    pub fn query(&self, name: &str, args: &Value) -> Result<Value> {
        mutations::query(&self.conn, name, args)
    }

    /// [`Self::mutate`] with JSON text in and out, for bindings.
    pub fn mutate_json(&mut self, name: &str, args: &str) -> Result<String> {
        let result = self.mutate(name, &parse(args)?)?;
        Ok(result.to_string())
    }

    /// [`Self::query`] with JSON text in and out, for bindings.
    pub fn query_json(&self, name: &str, args: &str) -> Result<String> {
        Ok(self.query(name, &parse(args)?)?.to_string())
    }

    pub fn push_request(&self, limit: u32) -> Result<Option<PushRequest>> {
        Ok(store_core::push_request(&self.conn, limit)?)
    }

    pub fn apply_push_response(&self, response: &PushResponse) -> Result<PushOutcome> {
        Ok(store_core::apply_push_response(&self.conn, response)?)
    }

    pub fn pull_request(&self, limit: u32) -> Result<PullRequest> {
        Ok(store_core::pull_request(&self.conn, limit)?)
    }

    pub fn apply_pull_response(&mut self, response: &PullResponse) -> Result<PullOutcome> {
        let mutator = self.mutator()?;
        Ok(store_core::apply_pull_response(
            &mut self.conn,
            &mutator,
            response,
        )?)
    }

    fn mutator(&self) -> Result<TimeMutator> {
        Ok(TimeMutator::for_scope(self.scope()?))
    }

    /// The next push as protobuf bytes, or `None` when nothing waits.
    pub fn push_request_bytes(&self, limit: u32) -> Result<Option<Vec<u8>>> {
        Ok(store_core::push_request_bytes(&self.conn, limit)?)
    }

    pub fn apply_push_response_bytes(&self, response: &[u8]) -> Result<PushOutcome> {
        Ok(store_core::apply_push_response_bytes(&self.conn, response)?)
    }

    pub fn pull_request_bytes(&self, limit: u32) -> Result<Vec<u8>> {
        Ok(store_core::pull_request_bytes(&self.conn, limit)?)
    }

    pub fn apply_pull_response_bytes(&mut self, response: &[u8]) -> Result<PullOutcome> {
        let mutator = self.mutator()?;
        Ok(store_core::apply_pull_response_bytes(
            &mut self.conn,
            &mutator,
            response,
        )?)
    }

    pub fn status(&self) -> Result<SyncStatus> {
        Ok(store_core::status(&self.conn)?)
    }

    /// [`Self::status`] as JSON with camelCase names.
    pub fn status_json(&self) -> Result<String> {
        Ok(store_core::status_json(&self.conn)?)
    }

    /// Changes the server refused that the user hasn't dismissed.
    pub fn issues(&self) -> Result<Vec<Issue>> {
        Ok(store_core::issues(&self.conn)?
            .into_iter()
            .map(Issue::from)
            .collect())
    }

    pub fn dismiss_issue(&self, id: i64) -> Result<bool> {
        Ok(store_core::dismiss_issue(&self.conn, id)?)
    }

    /// Queues a refused change again: the issue's mutation, with the same
    /// name and arguments, is applied here and waits to push like a new
    /// one. The issue is dismissed once it is queued; if the mutation
    /// fails here, the issue stays and the error is returned.
    pub fn retry_issue(&mut self, id: i64) -> Result<Value> {
        let issue = store_core::issues(&self.conn)?
            .into_iter()
            .find(|issue| issue.id == id)
            .ok_or_else(|| Error::not_found("Refused change"))?;
        let scope = self
            .scope()?
            .ok_or_else(|| Error::invalid("Sign in to send this change again."))?;
        let mutator = TimeMutator::for_scope(Some(scope));
        let outcome = store_core::mutate(&mut self.conn, &mutator, &issue.name, &issue.args)?;
        store_core::dismiss_issue(&self.conn, id)?;
        Ok(outcome.value)
    }

    /// Binds this device to `scope`, the account that signed in. A device
    /// that never signed in uploads its rows; one that belongs to another
    /// account is left alone until the user chooses.
    pub fn sign_in(&mut self, scope: Uuid) -> Result<SignIn> {
        match self.scope()? {
            Some(bound) if bound == scope => Ok(SignIn::Synced),
            Some(bound) => Ok(SignIn::OtherAccount { bound }),
            None => Ok(SignIn::Uploading {
                rows: upload::upload(&mut self.conn, scope)?,
            }),
        }
    }

    /// Moves this device to `scope`, uploading the data it holds now into
    /// that account. Changes still waiting for the old account go with it.
    pub fn keep_local(&mut self, scope: Uuid) -> Result<usize> {
        upload::upload(&mut self.conn, scope)
    }

    /// Moves this device to `scope`, dropping its rows; the account's data
    /// arrives with the next pull.
    pub fn start_fresh(&mut self, scope: Uuid) -> Result<()> {
        store_core::forget(&mut self.conn)?;
        store_core::bind_scope(&self.conn, scope)?;
        upload::seed_rituals(&self.conn, Some(scope))
    }

    /// Clears every synced row and the sync state, leaving a device that
    /// never signed in with its default rituals.
    pub fn forget(&mut self) -> Result<()> {
        store_core::forget(&mut self.conn)?;
        upload::seed_rituals(&self.conn, None)
    }
}

fn parse(args: &str) -> Result<Value> {
    if args.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(args).map_err(|error| Error::invalid(format!("Arguments: {error}")))
}
