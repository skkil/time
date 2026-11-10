//! Tauri commands: thin wrappers that apply writes through time-core's
//! mutation registry and answer reads straight from time-core.

pub mod blocks;
pub mod calendar;
pub mod canvas;
pub mod capture;
pub mod data;
pub mod dependencies;
pub mod glance;
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
use time_core::mutations;

use crate::db::Db;

/// Applies a write command through the sync engine and reads its result
/// back as `T`.
pub fn mutate<T: DeserializeOwned>(db: &Db, name: &str, args: Value) -> Result<T> {
    mutations::result(db.mutate(name, &args)?)
}
