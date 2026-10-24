use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::canvas::{self, ProjectCanvas};
use time_core::db::Db;
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn get_project_canvas(db: State<'_, Db>, project_id: Id) -> Result<ProjectCanvas> {
    db.call(|conn| canvas::get(conn, &project_id))
}

#[tauri::command]
#[specta::specta]
pub async fn save_project_canvas(
    db: State<'_, Db>,
    project_id: Id,
    content: String,
) -> Result<ProjectCanvas> {
    mutate(
        &db,
        "saveProjectCanvas",
        json!({ "projectId": project_id, "content": content }),
    )
}
