use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::blocks::{self, BlockSpan, TimeBlock};
use time_core::types::{Date, Id, Timestamp};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_blocks(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<TimeBlock>> {
    db.call(|conn| blocks::list(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn create_block(db: State<'_, Db>, task_id: Id, span: BlockSpan) -> Result<TimeBlock> {
    mutate(
        &db,
        "createBlock",
        json!({ "taskId": task_id, "span": span }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn reschedule_block(db: State<'_, Db>, id: Id, span: BlockSpan) -> Result<TimeBlock> {
    mutate(&db, "rescheduleBlock", json!({ "id": id, "span": span }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_block(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteBlock", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn count_ended_blocks(db: State<'_, Db>) -> Result<i32> {
    db.call(|conn| blocks::count_ended(conn, Timestamp::now()))
}

#[tauri::command]
#[specta::specta]
pub async fn log_ended_blocks(db: State<'_, Db>) -> Result<i32> {
    mutate(&db, "logEndedBlocks", json!({}))
}

#[tauri::command]
#[specta::specta]
pub async fn get_auto_log_blocks(db: State<'_, Db>) -> Result<bool> {
    db.call(|conn| blocks::auto_log_enabled(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_auto_log_blocks(db: State<'_, Db>, enabled: bool) -> Result<()> {
    mutate(&db, "setAutoLogBlocks", json!({ "enabled": enabled }))
}
