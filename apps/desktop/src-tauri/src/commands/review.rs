use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::db::Db;
use time_core::review::{self, Day, OutcomeStatus, Quarter, Week, WeekNotes, WeekSummary};
use time_core::types::{Date, Id};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_days(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<Day>> {
    db.call(|conn| review::days(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn rate_day(db: State<'_, Db>, date: Date, felt: i32) -> Result<()> {
    mutate(&db, "rateDay", json!({ "date": date, "felt": felt }))
}

#[tauri::command]
#[specta::specta]
pub async fn save_day_note(db: State<'_, Db>, date: Date, note: String) -> Result<()> {
    mutate(&db, "saveDayNote", json!({ "date": date, "note": note }))
}

#[tauri::command]
#[specta::specta]
pub async fn skip_day_check_in(db: State<'_, Db>, date: Date) -> Result<()> {
    mutate(&db, "skipDayCheckIn", json!({ "date": date }))
}

#[tauri::command]
#[specta::specta]
pub async fn get_week(db: State<'_, Db>, date: Date) -> Result<Week> {
    db.call(|conn| review::week(conn, date))
}

#[tauri::command]
#[specta::specta]
pub async fn list_weeks(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<WeekSummary>> {
    db.call(|conn| review::weeks(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn save_week_notes(db: State<'_, Db>, date: Date, notes: WeekNotes) -> Result<()> {
    mutate(
        &db,
        "saveWeekNotes",
        json!({ "date": date, "notes": notes }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn rate_week(db: State<'_, Db>, date: Date, felt: i32) -> Result<()> {
    mutate(&db, "rateWeek", json!({ "date": date, "felt": felt }))
}

#[tauri::command]
#[specta::specta]
pub async fn reach_review_step(db: State<'_, Db>, date: Date, step: i32) -> Result<()> {
    mutate(
        &db,
        "reachReviewStep",
        json!({ "date": date, "step": step }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn finish_week_review(db: State<'_, Db>, date: Date) -> Result<()> {
    mutate(&db, "finishWeekReview", json!({ "date": date }))
}

#[tauri::command]
#[specta::specta]
pub async fn create_outcome(
    db: State<'_, Db>,
    date: Date,
    title: String,
    priority_id: Option<Id>,
) -> Result<()> {
    mutate(
        &db,
        "createOutcome",
        json!({ "date": date, "title": title, "priorityId": priority_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_outcome(
    db: State<'_, Db>,
    id: Id,
    title: String,
    priority_id: Option<Id>,
) -> Result<()> {
    mutate(
        &db,
        "updateOutcome",
        json!({ "id": id, "title": title, "priorityId": priority_id }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_outcome_status(db: State<'_, Db>, id: Id, status: OutcomeStatus) -> Result<()> {
    mutate(
        &db,
        "updateOutcomeStatus",
        json!({ "id": id, "status": status }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn remove_outcome(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "removeOutcome", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn get_quarter(db: State<'_, Db>, date: Date) -> Result<Option<Quarter>> {
    db.call(|conn| review::quarter_for(conn, date))
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_quarter(
    db: State<'_, Db>,
    id: Option<Id>,
    label: String,
    start_date: Date,
) -> Result<Id> {
    mutate(
        &db,
        "upsertQuarter",
        json!({ "id": id, "label": label, "startDate": start_date }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn create_priority(db: State<'_, Db>, quarter_id: Id, title: String) -> Result<()> {
    mutate(
        &db,
        "createPriority",
        json!({ "quarterId": quarter_id, "title": title }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn update_priority(db: State<'_, Db>, id: Id, title: String, note: String) -> Result<()> {
    mutate(
        &db,
        "updatePriority",
        json!({ "id": id, "title": title, "note": note }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn remove_priority(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "removePriority", json!({ "id": id }))
}
