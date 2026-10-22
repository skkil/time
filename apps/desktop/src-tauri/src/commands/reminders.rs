use serde_json::json;
use tauri::State;
use time_core::db::Db;
use time_core::{Result, reminders};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn get_reminders_enabled(db: State<'_, Db>) -> Result<bool> {
    db.call(|conn| reminders::enabled(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_reminders_enabled(db: State<'_, Db>, enabled: bool) -> Result<()> {
    mutate(&db, "setRemindersEnabled", json!({ "enabled": enabled }))
}
