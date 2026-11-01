use std::sync::Arc;

use rusqlite::Connection;
use time_core::sync::{Engine, Uuid};

use crate::error::{CoreError, Result};
use crate::types::{PullApplied, SignInOutcome, SyncIssue, SyncState};
use crate::worker::Worker;

/// Opens (creating and migrating when needed) the SQLite database at
/// `path` and starts its engine thread.
#[uniffi::export]
pub async fn open(path: String) -> Result<Arc<TimeCore>> {
    let worker = Worker::open(move || {
        let conn = Connection::open(&path).map_err(time_core::Error::from)?;
        Ok(Engine::open(conn)?)
    })
    .await?;
    Ok(Arc::new(TimeCore { worker }))
}

/// One device's replica: every app command and the store sync steps.
#[derive(uniffi::Object)]
pub struct TimeCore {
    worker: Worker,
}

fn scope(id: &str) -> Result<Uuid> {
    id.parse().map_err(|_| CoreError::Invalid {
        message: format!("{id} isn't an account id."),
    })
}

#[uniffi::export]
impl TimeCore {
    /// Applies a write command by its contract name; arguments and result
    /// are JSON.
    pub async fn mutate(&self, name: String, args_json: String) -> Result<String> {
        self.worker
            .call(move |engine| Ok(engine.mutate_json(&name, &args_json)?))
            .await
    }

    /// Answers a read command by its contract name; arguments and result
    /// are JSON.
    pub async fn query(&self, name: String, args_json: String) -> Result<String> {
        self.worker
            .call(move |engine| Ok(engine.query_json(&name, &args_json)?))
            .await
    }

    /// The next binary `PushRequest`, or `None` when nothing waits.
    pub fn push_request(&self, limit: u32) -> Result<Option<Vec<u8>>> {
        self.worker
            .run(move |engine| Ok(engine.push_request_bytes(limit)?))
    }

    pub fn apply_push_response(&self, bytes: Vec<u8>) -> Result<()> {
        self.worker.run(move |engine| {
            engine.apply_push_response_bytes(&bytes)?;
            Ok(())
        })
    }

    /// The next binary `PullRequest` for at most `limit` versions.
    pub fn pull_request(&self, limit: u32) -> Result<Vec<u8>> {
        self.worker
            .run(move |engine| Ok(engine.pull_request_bytes(limit)?))
    }

    pub fn apply_pull_response(&self, bytes: Vec<u8>) -> Result<PullApplied> {
        self.worker
            .run(move |engine| Ok(engine.apply_pull_response_bytes(&bytes)?.into()))
    }

    pub fn status(&self) -> Result<SyncState> {
        self.worker.run(|engine| Ok(engine.status()?.into()))
    }

    /// Binds this device to the account `scope_id` (store's `bind_scope`
    /// through the engine's first-sign-in rules).
    pub async fn bind_scope(&self, scope_id: String) -> Result<SignInOutcome> {
        let scope = scope(&scope_id)?;
        self.worker
            .call(move |engine| Ok(engine.sign_in(scope)?.into()))
            .await
    }

    /// Moves this device to `scope_id`, uploading the data it holds now.
    pub async fn keep_local(&self, scope_id: String) -> Result<u64> {
        let scope = scope(&scope_id)?;
        self.worker
            .call(move |engine| Ok(engine.keep_local(scope)? as u64))
            .await
    }

    /// Moves this device to `scope_id`, dropping its rows for the account's.
    pub async fn start_fresh(&self, scope_id: String) -> Result<()> {
        let scope = scope(&scope_id)?;
        self.worker
            .call(move |engine| Ok(engine.start_fresh(scope)?))
            .await
    }

    /// Clears every synced row and the sync state.
    pub async fn forget(&self) -> Result<()> {
        self.worker.call(|engine| Ok(engine.forget()?)).await
    }

    /// Changes the server refused that the user hasn't dismissed.
    pub fn issues(&self) -> Result<Vec<SyncIssue>> {
        self.worker
            .run(|engine| Ok(engine.issues()?.into_iter().map(SyncIssue::from).collect()))
    }

    pub fn dismiss_issue(&self, id: i64) -> Result<bool> {
        self.worker.run(move |engine| Ok(engine.dismiss_issue(id)?))
    }
}
