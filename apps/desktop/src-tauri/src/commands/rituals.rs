use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::db::Db;
use time_core::rituals::{self, Moment, Ritual, RitualEvent, RitualInput, RitualRun};
use time_core::types::{Date, Id};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_rituals(db: State<'_, Db>) -> Result<Vec<Ritual>> {
    db.call(|conn| rituals::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn update_ritual(db: State<'_, Db>, kind: String, input: RitualInput) -> Result<Ritual> {
    mutate(&db, "updateRitual", json!({ "kind": kind, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn get_planning_time(db: State<'_, Db>) -> Result<Option<String>> {
    db.call(|conn| rituals::planning_time(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn choose_planning_time(db: State<'_, Db>, time: String) -> Result<Vec<Ritual>> {
    mutate(&db, "choosePlanningTime", json!({ "time": time }))
}

#[tauri::command]
#[specta::specta]
pub async fn due_ritual(db: State<'_, Db>, event: RitualEvent) -> Result<Option<Ritual>> {
    db.call(|conn| rituals::due(conn, Moment::now(), event))
}

#[tauri::command]
#[specta::specta]
pub async fn list_ritual_runs(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<RitualRun>> {
    db.call(|conn| rituals::runs(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn start_ritual(
    db: State<'_, Db>,
    kind: String,
    task_id: Option<Id>,
) -> Result<RitualRun> {
    mutate(
        &db,
        "startRitual",
        json!({ "kind": kind, "taskId": task_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn reach_ritual_step(db: State<'_, Db>, id: Id, step: i32) -> Result<RitualRun> {
    mutate(&db, "reachRitualStep", json!({ "id": id, "step": step }))
}

#[tauri::command]
#[specta::specta]
pub async fn finish_ritual(db: State<'_, Db>, id: Id) -> Result<RitualRun> {
    mutate(&db, "finishRitual", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn skip_ritual(db: State<'_, Db>, id: Id) -> Result<RitualRun> {
    mutate(&db, "skipRitual", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn snooze_ritual(db: State<'_, Db>, id: Id) -> Result<RitualRun> {
    mutate(&db, "snoozeRitual", json!({ "id": id }))
}
