use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::time_entries::{
    self, EntryDetails, EntryInput, RunningTimer, TimeEntry, TrackedEntry,
};
use time_core::types::{Date, Id};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_time_entries(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<TimeEntry>> {
    db.call(|conn| time_entries::list(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn list_task_entries(db: State<'_, Db>, task_id: Id) -> Result<Vec<TrackedEntry>> {
    db.call(|conn| time_entries::list_for_task(conn, &task_id))
}

#[tauri::command]
#[specta::specta]
pub async fn list_project_entries(db: State<'_, Db>, project_id: Id) -> Result<Vec<TrackedEntry>> {
    db.call(|conn| time_entries::list_for_project(conn, &project_id))
}

#[tauri::command]
#[specta::specta]
pub async fn create_time_entry(db: State<'_, Db>, input: EntryInput) -> Result<TimeEntry> {
    mutate(&db, "createTimeEntry", json!({ "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn update_time_entry(db: State<'_, Db>, id: Id, input: EntryInput) -> Result<TimeEntry> {
    mutate(&db, "updateTimeEntry", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_time_entry(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteTimeEntry", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn get_timer(db: State<'_, Db>) -> Result<Option<RunningTimer>> {
    db.call(|conn| time_entries::running(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn start_timer(db: State<'_, Db>, details: EntryDetails) -> Result<RunningTimer> {
    mutate(&db, "startTimer", json!({ "details": details }))
}

#[tauri::command]
#[specta::specta]
pub async fn edit_timer(db: State<'_, Db>, details: EntryDetails) -> Result<RunningTimer> {
    mutate(&db, "editTimer", json!({ "details": details }))
}

#[tauri::command]
#[specta::specta]
pub async fn stop_timer(db: State<'_, Db>) -> Result<Option<TimeEntry>> {
    mutate(&db, "stopTimer", json!({}))
}

#[tauri::command]
#[specta::specta]
pub async fn pause_timer(db: State<'_, Db>) -> Result<RunningTimer> {
    mutate(&db, "pauseTimer", json!({}))
}

#[tauri::command]
#[specta::specta]
pub async fn resume_timer(db: State<'_, Db>) -> Result<RunningTimer> {
    mutate(&db, "resumeTimer", json!({}))
}

#[tauri::command]
#[specta::specta]
pub async fn restore_timer(db: State<'_, Db>, timer: RunningTimer) -> Result<RunningTimer> {
    mutate(&db, "restoreTimer", json!({ "timer": timer }))
}

#[tauri::command]
#[specta::specta]
pub async fn discard_timer(db: State<'_, Db>) -> Result<()> {
    mutate(&db, "discardTimer", json!({}))
}
