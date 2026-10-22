//! Tauri commands: thin wrappers that apply writes through time-core's
//! mutation registry and answer reads straight from time-core.

pub mod blocks;
pub mod canvas;
pub mod capture;
pub mod data;
pub mod dependencies;
pub mod groups;
pub mod habits;
pub mod import;
pub mod projects;
pub mod records;
pub mod reminders;
pub mod review;
pub mod rituals;
pub mod sections;
pub mod tasks;
pub mod time_entries;
pub mod undo;
pub mod workflow;

use serde::de::DeserializeOwned;
use serde_json::Value;
use time_core::Result;
use time_core::db::Db;
use time_core::env::LocalEnv;
use time_core::mutations;

/// Applies a write command in its own transaction with the device's clock
/// and fresh UUIDv7 ids, and reads its result back as `T`.
pub fn mutate<T: DeserializeOwned>(db: &Db, name: &str, args: Value) -> Result<T> {
    let result =
        db.call(|conn| mutations::apply_in_transaction(conn, &LocalEnv::default(), name, &args))?;
    mutations::result(result)
}
