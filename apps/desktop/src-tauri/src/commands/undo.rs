use tauri::State;
use time_core::db::Db;
use time_core::types::Id;
use time_core::undo::{self, UndoLog};
use time_core::{Error, Result};

#[tauri::command]
#[specta::specta]
pub async fn capture_tasks(db: State<'_, Db>, log: State<'_, UndoLog>, ids: Vec<Id>) -> Result<Id> {
    let snapshot = db.call(|conn| undo::capture(conn, &ids))?;
    Ok(log.keep(snapshot))
}

#[tauri::command]
#[specta::specta]
pub async fn restore_tasks(db: State<'_, Db>, log: State<'_, UndoLog>, snapshot: Id) -> Result<()> {
    let snapshot = log
        .take(&snapshot)
        .ok_or_else(|| Error::invalid("This can no longer be undone."))?;
    db.call(|conn| undo::restore(conn, &snapshot))
}
