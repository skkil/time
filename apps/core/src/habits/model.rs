use serde::{Deserialize, Serialize};

use crate::types::{Date, Id};

pub const KINDS: [&str; 3] = ["build", "quit", "limit"];
pub const UNITS: [&str; 2] = ["times", "minutes"];
pub const TIMES_OF_DAY: [&str; 4] = ["anytime", "morning", "afternoon", "evening"];
pub const SYNC_DAYS: u64 = 60;
pub const ALL_DAYS: i32 = 0b111_1111;
pub const CONSISTENCY_DAYS: i64 = 14;
pub const MAX_SKIP_DAYS: i32 = 2;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Tracking {
    pub source: String,
    pub patterns: Vec<String>,
    pub project_id: Option<Id>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Habit {
    pub id: Id,
    pub name: String,
    pub kind: String,
    pub goal: f64,
    pub unit: String,
    pub days: i32,
    pub time_of_day: String,
    pub area: String,
    pub start_date: Date,
    pub tracking: Option<Tracking>,
    pub skip_days: i32,
    pub anchor: String,
    pub done_days: i32,
    pub due_days: i32,
    pub clean_since: Option<Date>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct HabitInput {
    pub name: String,
    pub kind: String,
    pub goal: f64,
    pub unit: String,
    pub days: i32,
    pub time_of_day: String,
    pub area: String,
    pub start_date: Date,
    pub tracking: Option<Tracking>,
    pub skip_days: i32,
    pub anchor: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum DayStatus {
    Done,
    Failed,
    Skipped,
    Pending,
    Missed,
    Off,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum ManualStatus {
    Done,
    Failed,
    Skipped,
}

impl ManualStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            ManualStatus::Done => "done",
            ManualStatus::Failed => "failed",
            ManualStatus::Skipped => "skipped",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct HabitDay {
    pub habit_id: Id,
    pub date: Date,
    pub status: DayStatus,
    pub value: f64,
    pub manual: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum TrackerState {
    NotNeeded,
    Connected,
    Unreachable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub activitywatch: TrackerState,
    pub has_web_data: bool,
    pub has_window_data: bool,
    pub message: Option<String>,
}

/// A value a device measured for a tracked habit on one day.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct HabitMeasurement {
    pub habit_id: Id,
    pub date: Date,
    pub value: f64,
}

/// One day's stored log: a status the user set, and the measured value.
#[derive(Debug, Clone)]
pub struct Log {
    pub status: Option<String>,
    pub value: f64,
}
