use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::types::Id;
use time_core::undo::{self, TaskSnapshot};

use super::mutate;
use crate::db::Db;

#[tauri::command]
#[specta::specta]
pub async fn capture_tasks(db: State<'_, Db>, ids: Vec<Id>) -> Result<TaskSnapshot> {
    db.call(|conn| undo::capture(conn, &ids))
}

#[tauri::command]
#[specta::specta]
pub async fn restore_tasks(db: State<'_, Db>, snapshot: TaskSnapshot) -> Result<()> {
    mutate(&db, "restoreTasks", json!({ "snapshot": snapshot }))
}
