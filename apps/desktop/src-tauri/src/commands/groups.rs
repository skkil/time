use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::db::Db;
use time_core::groups::{self, Group};
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_groups(db: State<'_, Db>) -> Result<Vec<Group>> {
    db.call(|conn| groups::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_group(db: State<'_, Db>, name: String) -> Result<Group> {
    mutate(&db, "createGroup", json!({ "name": name }))
}

#[tauri::command]
#[specta::specta]
pub async fn rename_group(db: State<'_, Db>, id: Id, name: String) -> Result<Group> {
    mutate(&db, "renameGroup", json!({ "id": id, "name": name }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_group(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteGroup", json!({ "id": id }))
}
