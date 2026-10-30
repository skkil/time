use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use time_core::types::Date;
use time_core::{Error, Result};

use super::mutate;
use crate::db::Db;

use crate::backup::{self, SeenVersion};

const BACKUP_FILTER: &str = "skkil time backup";
const BACKUP_EXTENSION: &str = "db";

#[tauri::command]
#[specta::specta]
pub async fn external_changes(db: State<'_, Db>, seen: State<'_, SeenVersion>) -> Result<bool> {
    let version = db.call(|conn| backup::data_version(conn))?;
    Ok(backup::changed_since(&seen, version))
}

#[tauri::command]
#[specta::specta]
pub async fn export_data(app: AppHandle, db: State<'_, Db>) -> Result<Option<String>> {
    let path = app
        .dialog()
        .file()
        .set_title("Export a backup")
        .set_file_name(format!("skkil-time-{}.db", Date::today().0))
        .add_filter(BACKUP_FILTER, &[BACKUP_EXTENSION])
        .blocking_save_file()
        .and_then(|file| file.into_path().ok());
    let Some(path) = path else {
        return Ok(None);
    };
    db.call(|conn| backup::export_to(conn, &path))?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn import_data(app: AppHandle, db: State<'_, Db>) -> Result<bool> {
    let path: Option<PathBuf> = app
        .dialog()
        .file()
        .set_title("Restore from a backup")
        .add_filter(BACKUP_FILTER, &[BACKUP_EXTENSION])
        .blocking_pick_file()
        .and_then(|file| file.into_path().ok());
    let Some(path) = path else {
        return Ok(false);
    };
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| Error::invalid(error.to_string()))?;
    db.engine(|engine| {
        backup::restore_from(engine.connection_mut(), &path, &data_dir)?;
        engine.refresh()
    })?;
    Ok(true)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_all_data(db: State<'_, Db>) -> Result<()> {
    mutate(&db, "deleteAllData", json!({}))
}
