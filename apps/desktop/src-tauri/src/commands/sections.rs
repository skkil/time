use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::db::Db;
use time_core::sections::{self, Section};
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_sections(db: State<'_, Db>) -> Result<Vec<Section>> {
    db.call(|conn| sections::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_section(
    db: State<'_, Db>,
    project_id: Option<Id>,
    name: String,
    before: Option<Id>,
) -> Result<Section> {
    mutate(
        &db,
        "createSection",
        json!({ "projectId": project_id, "name": name, "before": before }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn rename_section(db: State<'_, Db>, id: Id, name: String) -> Result<Section> {
    mutate(&db, "renameSection", json!({ "id": id, "name": name }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_section_collapsed(db: State<'_, Db>, id: Id, collapsed: bool) -> Result<Section> {
    mutate(
        &db,
        "setSectionCollapsed",
        json!({ "id": id, "collapsed": collapsed }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_section(db: State<'_, Db>, id: Id, before: Option<Id>) -> Result<Section> {
    mutate(&db, "reorderSection", json!({ "id": id, "before": before }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_section(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteSection", json!({ "id": id }))
}
