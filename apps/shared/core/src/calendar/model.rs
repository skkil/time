use serde::{Deserialize, Serialize};

use crate::types::{Date, Id, Timestamp};

/// One calendar of a connected account.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CalendarSource {
    pub id: Id,
    pub account_id: Id,
    pub name: String,
    pub color: String,
    pub visible: bool,
    pub position: i32,
}

/// An event of a visible calendar. Timed events span `start_at..end_at`;
/// all-day events cover `start_date` up to, not including, `end_date`, and
/// their `start_at`/`end_at` are those days' local midnights.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: Id,
    pub source_id: Id,
    pub source_name: String,
    pub color: String,
    pub title: String,
    pub start_at: Timestamp,
    pub end_at: Timestamp,
    pub all_day: bool,
    pub start_date: Option<Date>,
    pub end_date: Option<Date>,
    pub location: Option<String>,
    pub link: Option<String>,
    pub tentative: bool,
}
