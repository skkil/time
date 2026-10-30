use crate::db::Db;
use serde_json::json;
use tauri::{AppHandle, Manager, State};
use time_core::tasks::Task;
use time_core::types::{Date, Id};
use time_core::workflow::{
    self, EventOccurrence, ItemTypeInput, MilestoneInput, Preset, StatusInput, TypeTime, ViewInput,
    Workflow,
};
use time_core::{Error, Result};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn get_workflow(db: State<'_, Db>) -> Result<Workflow> {
    db.call(|conn| workflow::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn list_presets() -> Result<Vec<Preset>> {
    Ok(workflow::presets())
}

#[tauri::command]
#[specta::specta]
pub async fn create_item_type(
    db: State<'_, Db>,
    project_id: Id,
    input: ItemTypeInput,
) -> Result<Id> {
    mutate(
        &db,
        "createItemType",
        json!({ "projectId": project_id, "input": input }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_item_type(db: State<'_, Db>, id: Id, input: ItemTypeInput) -> Result<()> {
    mutate(&db, "updateItemType", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_item_type(db: State<'_, Db>, id: Id, replacement: Option<Id>) -> Result<()> {
    mutate(
        &db,
        "deleteItemType",
        json!({ "id": id, "replacement": replacement }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn create_item_status(
    db: State<'_, Db>,
    project_id: Id,
    input: StatusInput,
) -> Result<Id> {
    mutate(
        &db,
        "createItemStatus",
        json!({ "projectId": project_id, "input": input }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_item_status(db: State<'_, Db>, id: Id, input: StatusInput) -> Result<()> {
    mutate(&db, "updateItemStatus", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_item_status(db: State<'_, Db>, id: Id, before: Option<Id>) -> Result<()> {
    mutate(
        &db,
        "reorderItemStatus",
        json!({ "id": id, "before": before }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn delete_item_status(db: State<'_, Db>, id: Id, replacement: Option<Id>) -> Result<()> {
    mutate(
        &db,
        "deleteItemStatus",
        json!({ "id": id, "replacement": replacement }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn create_project_milestone(
    db: State<'_, Db>,
    project_id: Id,
    input: MilestoneInput,
) -> Result<Id> {
    mutate(
        &db,
        "createProjectMilestone",
        json!({ "projectId": project_id, "input": input }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_project_milestone(
    db: State<'_, Db>,
    id: Id,
    input: MilestoneInput,
) -> Result<()> {
    mutate(
        &db,
        "updateProjectMilestone",
        json!({ "id": id, "input": input }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn delete_project_milestone(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteProjectMilestone", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_milestone_label(db: State<'_, Db>, id: Id, label: String) -> Result<()> {
    mutate(
        &db,
        "setProjectMilestoneLabel",
        json!({ "id": id, "label": label }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn create_saved_view(db: State<'_, Db>, project_id: Id, input: ViewInput) -> Result<Id> {
    mutate(
        &db,
        "createSavedView",
        json!({ "projectId": project_id, "input": input }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_saved_view(db: State<'_, Db>, id: Id, input: ViewInput) -> Result<()> {
    mutate(&db, "updateSavedView", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_saved_view(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteSavedView", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn apply_project_preset(db: State<'_, Db>, id: Id, preset: Preset) -> Result<()> {
    mutate(
        &db,
        "applyProjectPreset",
        json!({ "id": id, "preset": preset }),
    )
}

/// Writes the project's workflow as a preset file in Downloads and
/// returns its path.
#[tauri::command]
#[specta::specta]
pub async fn save_project_preset(app: AppHandle, db: State<'_, Db>, id: Id) -> Result<String> {
    let preset = db.call(|conn| workflow::export_preset(conn, &id))?;
    let folder = app
        .path()
        .download_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|_| Error::invalid("Couldn't find a folder to save the preset in."))?;
    let path = folder.join(format!("{}.skkil-preset.json", preset.key));
    let text = serde_json::to_string_pretty(&preset)
        .map_err(|_| Error::invalid("Couldn't write the preset."))?;
    std::fs::write(&path, text).map_err(|e| Error::invalid(format!("Couldn't save: {e}")))?;
    Ok(path.display().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn read_preset(text: String) -> Result<Preset> {
    workflow::parse_preset(&text)
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_type_id(db: State<'_, Db>, id: Id, type_id: Option<Id>) -> Result<Task> {
    mutate(&db, "setTaskTypeId", json!({ "id": id, "typeId": type_id }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_status_id(db: State<'_, Db>, id: Id, status_id: Id) -> Result<Task> {
    mutate(
        &db,
        "setTaskStatusId",
        json!({ "id": id, "statusId": status_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_milestone_id(
    db: State<'_, Db>,
    id: Id,
    milestone_id: Option<Id>,
) -> Result<Task> {
    mutate(
        &db,
        "setTaskMilestoneId",
        json!({ "id": id, "milestoneId": milestone_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_event_details(
    db: State<'_, Db>,
    id: Id,
    location: String,
    counts_as_time: bool,
) -> Result<Task> {
    mutate(
        &db,
        "setTaskEventDetails",
        json!({ "id": id, "location": location, "countsAsTime": counts_as_time }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn list_events(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<EventOccurrence>> {
    db.call(|conn| workflow::occurrences(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn list_time_by_type(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<TypeTime>> {
    db.call(|conn| workflow::time_by_type(conn, from, to))
}
