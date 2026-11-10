use crate::db::Db;
use serde_json::json;
use tauri::State;
use time_core::Result;
use time_core::calendar::{self, CalendarEvent, CalendarSource};
use time_core::types::{Date, Id};

use super::mutate;

#[tauri::command]
#[specta::specta]
pub async fn list_calendar_sources(db: State<'_, Db>) -> Result<Vec<CalendarSource>> {
    db.call(|conn| calendar::sources(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn list_calendar_events(
    db: State<'_, Db>,
    from: Date,
    to: Date,
) -> Result<Vec<CalendarEvent>> {
    db.call(|conn| calendar::events(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn set_calendar_source_visible(
    db: State<'_, Db>,
    id: Id,
    visible: bool,
) -> Result<CalendarSource> {
    mutate(
        &db,
        "setCalendarSourceVisible",
        json!({ "id": id, "visible": visible }),
    )
}
