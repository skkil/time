use std::collections::HashMap;

use rusqlite::{Connection, params};
use serde_json::Value;
use store_core::protocol::v1::{
    Change, Entries, MutationResult, PullRequest, PullResponse, PushRequest, PushResponse,
    Rejection, Reset, Version, change::Op, mutation_result::Status, pull_response::Body,
};
use store_core::uuid::Uuid;
use store_core::{Hlc, MutationContext, Mutator};

use crate::data::{LocalData, SYNCED_TABLES, dump};
use crate::db;
use crate::rituals::ritual_id;
use crate::sync::TimeMutator;

/// A product server and store service in one, for one account: it applies
/// pushed mutations with the same [`TimeMutator`] on its own time database,
/// logs every row change through triggers and serves pulls by cursor, with
/// the epoch and hash checks of the real service. store-testkit's fake
/// server only runs its sample planner, so time keeps its own.
pub struct FakeServer {
    db: Connection,
    pub scope: Uuid,
    epoch: u32,
    versions: Vec<Version>,
    clients: HashMap<Uuid, u64>,
}

fn columns(db: &Connection, table: &str) -> Vec<String> {
    db.prepare("SELECT name FROM pragma_table_info(?1)")
        .unwrap()
        .query_map([table], |row| row.get(0))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

fn change_log(db: &Connection) {
    db.execute_batch(
        "CREATE TABLE change_log (
           seq INTEGER PRIMARY KEY, table_name TEXT NOT NULL, row_id TEXT NOT NULL,
           op TEXT NOT NULL, data TEXT
         )",
    )
    .unwrap();
    for table in SYNCED_TABLES {
        let image = columns(db, table)
            .iter()
            .map(|column| format!("'{column}', NEW.\"{column}\""))
            .collect::<Vec<_>>()
            .join(", ");
        for event in ["INSERT", "UPDATE"] {
            db.execute_batch(&format!(
                "CREATE TRIGGER {table}_log_{event} AFTER {event} ON {table} BEGIN
                   INSERT INTO change_log (table_name, row_id, op, data)
                   VALUES ('{table}', NEW.id, 'upsert', json_object({image}));
                 END"
            ))
            .unwrap();
        }
        db.execute_batch(&format!(
            "CREATE TRIGGER {table}_log_delete AFTER DELETE ON {table} BEGIN
               INSERT INTO change_log (table_name, row_id, op) VALUES ('{table}', OLD.id, 'delete');
             END"
        ))
        .unwrap();
    }
}

impl FakeServer {
    /// A new account whose rituals the server seeded, as version 1.
    pub fn new() -> Self {
        let mut db = Connection::open_in_memory().unwrap();
        db::migrate(&mut db).unwrap();
        db.execute("DELETE FROM ritual", []).unwrap();
        change_log(&db);
        let mut server = Self {
            db,
            scope: Uuid::now_v7(),
            epoch: 1,
            versions: Vec::new(),
            clients: HashMap::new(),
        };
        let scope = server.scope;
        server.server_write(|db| {
            crate::sync::upload::seed_rituals(db, Some(scope)).unwrap();
            assert_eq!(
                db.query_row("SELECT id FROM ritual WHERE kind = 'morning'", [], |row| {
                    row.get::<_, String>(0)
                })
                .unwrap(),
                ritual_id(scope, "morning").to_string()
            );
        });
        server
    }

    pub fn head(&self) -> u64 {
        self.versions.len() as u64
    }

    /// Every synced row on the server.
    pub fn data(&self) -> LocalData {
        dump(&self.db).unwrap()
    }

    /// A write the server makes on its own, logged as one version.
    pub fn server_write(&mut self, write: impl FnOnce(&Connection)) {
        self.db.execute("DELETE FROM change_log", []).unwrap();
        write(&self.db);
        let changes = self.read_changes();
        self.log(Uuid::nil(), self.head() + 1, changes, None);
    }

    pub fn push(&mut self, request: &PushRequest) -> PushResponse {
        let client = Uuid::parse_str(&request.client_id).unwrap();
        let mut results = Vec::new();
        for mutation in &request.mutations {
            let last = self.clients.get(&client).copied().unwrap_or(0);
            if mutation.mutation_id <= last {
                results.push(MutationResult {
                    mutation_id: mutation.mutation_id,
                    status: Status::Duplicate as i32,
                    reason: String::new(),
                    version: 0,
                });
                continue;
            }
            let args: Value = serde_json::from_slice(&mutation.args).unwrap();
            let mut ctx =
                MutationContext::new(client, mutation.mutation_id, Hlc::from_i64(mutation.hlc));
            let tx = self.db.transaction().unwrap();
            tx.execute("DELETE FROM change_log", []).unwrap();
            tx.execute_batch("SAVEPOINT mutation").unwrap();
            let outcome = TimeMutator::for_scope(Some(self.scope)).apply(
                &tx,
                &mut ctx,
                &mutation.name,
                &args,
            );
            let rejection = match outcome {
                Ok(_) => None,
                Err(error) => {
                    tx.execute_batch("ROLLBACK TO mutation").unwrap();
                    Some(error.to_string())
                }
            };
            tx.execute_batch("RELEASE mutation").unwrap();
            tx.commit().unwrap();
            let changes = if rejection.is_some() {
                Vec::new()
            } else {
                self.read_changes()
            };
            let status = if rejection.is_some() {
                Status::Rejected
            } else {
                Status::Applied
            };
            let version = self.log(client, mutation.mutation_id, changes, rejection.clone());
            self.clients.insert(client, mutation.mutation_id);
            results.push(MutationResult {
                mutation_id: mutation.mutation_id,
                status: status as i32,
                reason: rejection.unwrap_or_default(),
                version,
            });
        }
        PushResponse { results }
    }

    pub fn pull(&self, request: &PullRequest) -> PullResponse {
        let client = Uuid::parse_str(&request.client_id).unwrap();
        let cursor = request.cursor.clone().unwrap_or_default();
        let fresh = cursor.version == 0 && cursor.hash.is_empty();
        let body = if (!fresh && cursor.epoch != self.epoch)
            || cursor.version > self.head()
            || (cursor.version > 0
                && self.versions[cursor.version as usize - 1].hash != cursor.hash)
        {
            Body::Reset(Reset {
                epoch: self.epoch,
                reason: "cursor doesn't match the log".into(),
            })
        } else {
            let limit = if request.limit == 0 {
                usize::MAX
            } else {
                request.limit as usize
            };
            let versions: Vec<Version> = self.versions[cursor.version as usize..]
                .iter()
                .take(limit)
                .cloned()
                .collect();
            let more = cursor.version + (versions.len() as u64) < self.head();
            Body::Entries(Entries { versions, more })
        };
        PullResponse {
            body: Some(body),
            last_mutation_id: self.clients.get(&client).copied().unwrap_or(0),
            head_version: self.head(),
            epoch: self.epoch,
        }
    }

    fn read_changes(&self) -> Vec<Change> {
        self.db
            .prepare("SELECT table_name, row_id, op, data FROM change_log ORDER BY seq")
            .unwrap()
            .query_map(params![], |row| {
                let op: String = row.get(2)?;
                Ok(Change {
                    table: row.get(0)?,
                    row_id: row.get(1)?,
                    op: if op == "delete" {
                        Op::Delete
                    } else {
                        Op::Upsert
                    } as i32,
                    data: row
                        .get::<_, Option<String>>(3)?
                        .unwrap_or_default()
                        .into_bytes(),
                })
            })
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    }

    fn log(
        &mut self,
        client: Uuid,
        mutation_id: u64,
        changes: Vec<Change>,
        rejection: Option<String>,
    ) -> u64 {
        let number = self.head() + 1;
        let previous = self
            .versions
            .last()
            .map(|v| v.hash.clone())
            .unwrap_or_default();
        let hash = [
            previous.as_slice(),
            format!("{number}|{client}|{mutation_id}").as_bytes(),
        ]
        .concat();
        self.versions.push(Version {
            version: number,
            client_id: client.to_string(),
            mutation_id,
            hash,
            committed_at: number as i64,
            changes,
            rejection: rejection.map(|reason| Rejection {
                mutation_id,
                reason,
            }),
        });
        number
    }
}
