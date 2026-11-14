use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::tasks::{self, BlockMove, MoveResult, MoveTarget, Task, TaskInput, TaskPlacement};
use time_core::types::{Date, Id};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_tasks(db: State<'_, Db>) -> Result<Vec<Task>> {
    db.call(|conn| tasks::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn get_task(db: State<'_, Db>, id: Id) -> Result<Task> {
    db.call(|conn| tasks::get(conn, &id))
}

#[tauri::command]
#[specta::specta]
pub async fn create_task(db: State<'_, Db>, input: TaskInput) -> Result<Task> {
    mutate(&db, "createTask", json!({ "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn update_task(db: State<'_, Db>, id: Id, input: TaskInput) -> Result<Task> {
    mutate(&db, "updateTask", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn move_task(db: State<'_, Db>, id: Id, placement: TaskPlacement) -> Result<Task> {
    mutate(&db, "moveTask", json!({ "id": id, "placement": placement }))
}

#[tauri::command]
#[specta::specta]
pub async fn reschedule_tasks(
    db: State<'_, Db>,
    ids: Vec<Id>,
    due_date: Option<Date>,
) -> Result<()> {
    mutate(
        &db,
        "rescheduleTasks",
        json!({ "ids": ids, "dueDate": due_date }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn move_tasks(
    db: State<'_, Db>,
    ids: Vec<Id>,
    target: MoveTarget,
    blocks: Option<BlockMove>,
) -> Result<MoveResult> {
    mutate(
        &db,
        "moveTasks",
        json!({ "ids": ids, "target": target, "blocks": blocks }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_completed(db: State<'_, Db>, id: Id, completed: bool) -> Result<Task> {
    mutate(
        &db,
        "setTaskCompleted",
        json!({ "id": id, "completed": completed }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_outcome(db: State<'_, Db>, id: Id, outcome_id: Option<Id>) -> Result<Task> {
    mutate(
        &db,
        "setTaskOutcome",
        json!({ "id": id, "outcomeId": outcome_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_must(db: State<'_, Db>, id: Id, must_on: Option<Date>) -> Result<Task> {
    mutate(&db, "setTaskMust", json!({ "id": id, "mustOn": must_on }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_next_step(db: State<'_, Db>, id: Id, next_step: String) -> Result<Task> {
    mutate(
        &db,
        "setTaskNextStep",
        json!({ "id": id, "nextStep": next_step }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn delete_tasks(db: State<'_, Db>, ids: Vec<Id>) -> Result<()> {
    mutate(&db, "deleteTasks", json!({ "ids": ids }))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_task(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "deleteTask", json!({ "id": id }))
}
