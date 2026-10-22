use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::db::Db;
use time_core::tasks::Task;
use time_core::types::Id;

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn add_task_dependency(
    db: State<'_, Db>,
    task_id: Id,
    blocked_by_id: Id,
) -> Result<Task> {
    mutate(
        &db,
        "addTaskDependency",
        json!({ "taskId": task_id, "blockedById": blocked_by_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn remove_task_dependency(
    db: State<'_, Db>,
    task_id: Id,
    blocked_by_id: Id,
) -> Result<Task> {
    mutate(
        &db,
        "removeTaskDependency",
        json!({ "taskId": task_id, "blockedById": blocked_by_id }),
    )
}
