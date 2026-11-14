use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::places::{self, Place};
use time_core::tasks::Task;
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_places(db: State<'_, Db>) -> Result<Vec<Place>> {
    db.call(|conn| places::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_place(db: State<'_, Db>, name: String) -> Result<Place> {
    mutate(&db, "createPlace", json!({ "name": name }))
}

#[tauri::command]
#[specta::specta]
pub async fn rename_place(db: State<'_, Db>, id: Id, name: String) -> Result<Place> {
    mutate(&db, "renamePlace", json!({ "id": id, "name": name }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_place(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deletePlace", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_place(db: State<'_, Db>, id: Id, place_id: Option<Id>) -> Result<Task> {
    mutate(
        &db,
        "setTaskPlace",
        json!({ "id": id, "placeId": place_id }),
    )
}
