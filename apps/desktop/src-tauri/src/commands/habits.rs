use serde_json::json;
use tauri::State;
use time_core::db::Db;
use time_core::habits::activity::{Event, WEB_BUCKET, WINDOW_BUCKET};
use time_core::habits::{
    self, Habit, HabitDay, HabitInput, HabitMeasurement, ManualStatus, SyncReport, TrackerState,
};
use time_core::types::{Date, Id};
use time_core::{Error, Result};

use super::mutate;
use crate::activitywatch;

#[tauri::command]
#[specta::specta]
pub async fn list_habits(db: State<'_, Db>) -> Result<Vec<Habit>> {
    db.call(|conn| habits::list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_habit(db: State<'_, Db>, input: HabitInput) -> Result<Habit> {
    mutate(&db, "createHabit", json!({ "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn update_habit(db: State<'_, Db>, id: Id, input: HabitInput) -> Result<Habit> {
    mutate(&db, "updateHabit", json!({ "id": id, "input": input }))
}

#[tauri::command]
#[specta::specta]
pub async fn archive_habit(db: State<'_, Db>, id: Id) -> Result<()> {
    mutate(&db, "archiveHabit", json!({ "id": id }))
}

#[tauri::command]
#[specta::specta]
pub async fn list_habit_days(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<HabitDay>> {
    db.call(|conn| habits::days(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn set_habit_status(
    db: State<'_, Db>,
    habit_id: Id,
    date: Date,
    status: Option<ManualStatus>,
) -> Result<()> {
    mutate(
        &db,
        "setHabitStatus",
        json!({ "habitId": habit_id, "date": date, "status": status }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn add_habit_value(
    db: State<'_, Db>,
    habit_id: Id,
    date: Date,
    delta: Option<f64>,
) -> Result<()> {
    mutate(
        &db,
        "addHabitValue",
        json!({ "habitId": habit_id, "date": date, "delta": delta }),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn record_habit_measurements(
    db: State<'_, Db>,
    measurements: Vec<HabitMeasurement>,
) -> Result<()> {
    mutate(
        &db,
        "recordHabitMeasurements",
        json!({ "measurements": measurements }),
    )
}

fn fetch_activity(habits: &[Habit], today: Date) -> Result<(Vec<Event>, Vec<Event>)> {
    let (start, end) = habits::activity_span(habits, today);
    let fetch = |source: &str, bucket: &str| {
        if habits::needs_source(habits, source) {
            activitywatch::events(bucket, start, end)
        } else {
            Ok(Vec::new())
        }
    };
    Ok((fetch("website", WEB_BUCKET)?, fetch("app", WINDOW_BUCKET)?))
}

fn report(activitywatch: TrackerState, web: &[Event], windows: &[Event]) -> SyncReport {
    SyncReport {
        activitywatch,
        has_web_data: !web.is_empty(),
        has_window_data: !windows.is_empty(),
        message: None,
    }
}

/// Refreshes measured habit values: project habits from tracked time, and
/// website and app habits from ActivityWatch through
/// `recordHabitMeasurements`.
#[tauri::command]
#[specta::specta]
pub async fn sync_habits(db: State<'_, Db>) -> Result<SyncReport> {
    let today = Date::today();
    let watched: Vec<Habit> = db.call(|conn| {
        let tracked = habits::tracked(conn)?;
        habits::sync_projects(conn, &tracked, today)?;
        Ok(tracked
            .into_iter()
            .filter(|habit| {
                habit
                    .tracking
                    .as_ref()
                    .is_some_and(|t| t.source != "project")
            })
            .collect())
    })?;
    if watched.is_empty() {
        return Ok(report(TrackerState::NotNeeded, &[], &[]));
    }
    let fetch_for = watched.clone();
    let fetched = tauri::async_runtime::spawn_blocking(move || fetch_activity(&fetch_for, today))
        .await
        .map_err(|error| Error::invalid(format!("Sync stopped: {error}")))?;
    match fetched {
        Ok((web, windows)) => {
            let measurements = habits::measure_activity(&watched, &web, &windows, today);
            mutate::<()>(
                &db,
                "recordHabitMeasurements",
                json!({ "measurements": measurements }),
            )?;
            Ok(report(TrackerState::Connected, &web, &windows))
        }
        Err(error) => Ok(SyncReport {
            message: Some(error.to_string()),
            ..report(TrackerState::Unreachable, &[], &[])
        }),
    }
}
