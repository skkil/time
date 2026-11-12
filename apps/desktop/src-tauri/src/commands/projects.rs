use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::projects::{self, Project, ProjectInput, ProjectSettings};
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_projects(db: State<'_, Db>) -> Result<Vec<Project>> {
    db.call(|conn| projects::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_project(db: State<'_, Db>, input: ProjectInput) -> Result<Project> {
    mutate(&db, "createProject", json!({ "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn update_project(db: State<'_, Db>, id: Id, input: ProjectInput) -> Result<Project> {
    mutate(&db, "updateProject", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_archived(db: State<'_, Db>, id: Id, archived: bool) -> Result<()> {
    mutate(
        &db,
        "setProjectArchived",
        json!({ "id": id, "archived": archived }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_view(db: State<'_, Db>, id: Id, view: String) -> Result<Project> {
    mutate(&db, "setProjectView", json!({ "id": id, "view": view }))
}

#[tauri::command]
#[specta::specta]
pub async fn update_project_settings(
    db: State<'_, Db>,
    id: Id,
    settings: ProjectSettings,
) -> Result<Project> {
    mutate(
        &db,
        "updateProjectSettings",
        json!({ "id": id, "settings": settings }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn mark_project_reviewed(db: State<'_, Db>, id: Id) -> Result<Project> {
    mutate(&db, "markProjectReviewed", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_project(db: State<'_, Db>, id: Id, before: Option<Id>) -> Result<Project> {
    mutate(&db, "reorderProject", json!({ "id": id, "before": before }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_project(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteProject", json!({ "id": id }))
}
