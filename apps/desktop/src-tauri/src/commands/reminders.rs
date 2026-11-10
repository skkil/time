use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::reminders::{self, NotificationPrefs, Reminder};
use time_core::types::Timestamp;

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

#[tauri::command]
#[specta::specta]
pub async fn list_reminders(
    db: State<'_, Db>,
    from: Timestamp,
    to: Timestamp,
    prefs: NotificationPrefs,
) -> Result<Vec<Reminder>> {
    db.call(|conn| reminders::upcoming(conn, from, to, &prefs))
}

#[tauri::command]
#[specta::specta]
pub async fn get_notification_prefs(db: State<'_, Db>) -> Result<NotificationPrefs> {
    db.call(|conn| reminders::device_prefs(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_notification_prefs(db: State<'_, Db>, prefs: NotificationPrefs) -> Result<()> {
    db.call(|conn| reminders::set_device_prefs(conn, &prefs))
}
