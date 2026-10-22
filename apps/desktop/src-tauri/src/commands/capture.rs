use tauri::{AppHandle, State};
use time_core::Result;
use time_core::db::Db;

use crate::capture;

#[tauri::command]
#[specta::specta]
pub async fn get_capture_hotkey(db: State<'_, Db>) -> Result<bool> {
    db.call(|conn| capture::enabled(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_capture_hotkey(app: AppHandle, db: State<'_, Db>, enabled: bool) -> Result<()> {
    capture::apply(&app, enabled)?;
    db.call(|conn| capture::set_enabled(conn, enabled))
}
