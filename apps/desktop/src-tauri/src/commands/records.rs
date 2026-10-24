use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::db::Db;
use time_core::records::{self, RecordPhase};
use time_core::tasks::Task;
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_record_phases(db: State<'_, Db>, task_id: Id) -> Result<Vec<RecordPhase>> {
    db.call(|conn| records::phases(conn, &task_id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_record_phase_notes(
    db: State<'_, Db>,
    task_id: Id,
    status_id: Id,
    notes: String,
) -> Result<()> {
    mutate(
        &db,
        "setRecordPhaseNotes",
        json!({ "taskId": task_id, "statusId": status_id, "notes": notes }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_phase(db: State<'_, Db>, id: Id, phase_id: Option<Id>) -> Result<Task> {
    mutate(
        &db,
        "setTaskPhase",
        json!({ "id": id, "phaseId": phase_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn create_phase_task(
    db: State<'_, Db>,
    record_id: Id,
    phase_id: Id,
    title: String,
) -> Result<Task> {
    mutate(
        &db,
        "createPhaseTask",
        json!({ "recordId": record_id, "phaseId": phase_id, "title": title }),
    )
}
