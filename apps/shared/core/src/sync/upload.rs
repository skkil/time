//! Moving a device's rows into an account: on its first sign-in, or when
//! the user chooses to keep local data while switching accounts.
//!
//! The rows are staged in `device_setting` first, then store forgets the
//! old identity (clearing synced rows, the queue and the cursor), binds the
//! new scope and queues one `importLocal` mutation that writes the rows
//! back. Staging makes the step safe to resume: [`resume`] finishes an
//! upload a crash interrupted.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use serde_json::json;
use store_core::uuid::Uuid;

use super::mutator::TimeMutator;
use crate::data::{self, LocalData};
use crate::device_settings;
use crate::error::{Error, Result};
use crate::rituals::{DEFAULTS, ritual_id};
use crate::types::Id;

const STAGED_KEY: &str = "sync_upload";

#[derive(Serialize, Deserialize)]
struct Staged {
    scope: Uuid,
    data: LocalData,
}

/// Inserts the default rituals that are missing, outside any mutation: an
/// account (`scope`) has them already with its derived ids, so they never
/// need uploading, and the app has its rituals before the first pull. A
/// device without an account gets new ids.
pub fn seed_rituals(conn: &Connection, scope: Option<Uuid>) -> Result<()> {
    for ritual in &DEFAULTS {
        let id = match scope {
            Some(scope) => ritual_id(scope, ritual.kind),
            None => Id::from(Uuid::now_v7()),
        };
        conn.execute(
            "INSERT OR IGNORE INTO ritual (id, kind, enabled, trigger, at_minute, weekdays, steps)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                ritual.kind,
                ritual.enabled,
                ritual.trigger,
                ritual.at_minute,
                ritual.weekdays,
                ritual.steps
            ],
        )?;
    }
    Ok(())
}

/// Stages every synced row for `scope` and finishes the upload. Returns
/// how many rows were queued. Rows that belonged to another account take
/// new ids, since that account still has the old ones.
pub fn upload(conn: &mut Connection, scope: Uuid) -> Result<usize> {
    let mut data = data::dump(conn)?;
    if store_core::status(conn)?.scope_id.is_some() {
        data = data.with_new_ids();
    }
    let data = data.with_seed_ids(scope);
    let staged = serde_json::to_string(&Staged { scope, data })
        .map_err(|error| Error::Database(error.to_string()))?;
    device_settings::write(conn, STAGED_KEY, &staged)?;
    finish(conn)
}

/// Finishes a staged upload, if one is waiting.
pub fn resume(conn: &mut Connection) -> Result<Option<usize>> {
    if device_settings::read(conn, STAGED_KEY)?.is_none() {
        return Ok(None);
    }
    finish(conn).map(Some)
}

fn finish(conn: &mut Connection) -> Result<usize> {
    let staged = device_settings::read(conn, STAGED_KEY)?
        .ok_or_else(|| Error::invalid("Nothing is waiting to upload."))?;
    let Staged { scope, data } =
        serde_json::from_str(&staged).map_err(|error| Error::Database(error.to_string()))?;
    store_core::forget(conn)?;
    store_core::bind_scope(conn, scope)?;
    seed_rituals(conn, Some(scope))?;
    if !data.is_empty() {
        let mutator = TimeMutator::for_scope(Some(scope));
        store_core::mutate(conn, &mutator, "importLocal", &json!({ "data": data }))?;
    }
    device_settings::remove(conn, STAGED_KEY)?;
    Ok(data.rows())
}
