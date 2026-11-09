use serde::{Deserialize, Serialize};

use crate::types::{Date, Id, Seconds, Timestamp};

pub const MAX_OPEN_OUTCOMES: i64 = 3;
pub const MAX_CARRIES: i32 = 2;
pub const MAX_PRIORITIES: i64 = 3;
pub const LAST_STEP: i32 = 6;
pub const WEEKS_PER_QUARTER: i64 = 13;
pub const TIMED_TASK_MINUTES: i32 = 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Day {
    pub date: Date,
    pub felt: Option<i32>,
    pub note: String,
    pub skipped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct WeekNotes {
    pub worked: String,
    pub fell_short: String,
    pub change: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum OutcomeStatus {
    Open,
    Achieved,
    Carried,
    Dropped,
}

impl OutcomeStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Achieved => "achieved",
            Self::Carried => "carried",
            Self::Dropped => "dropped",
        }
    }

    pub fn parse(value: &str) -> rusqlite::Result<Self> {
        match value {
            "open" => Ok(Self::Open),
            "achieved" => Ok(Self::Achieved),
            "carried" => Ok(Self::Carried),
            "dropped" => Ok(Self::Dropped),
            other => Err(rusqlite::Error::InvalidColumnType(
                0,
                other.to_owned(),
                rusqlite::types::Type::Text,
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub id: Id,
    pub title: String,
    pub status: OutcomeStatus,
    pub priority_id: Option<Id>,
    pub carried_from: Option<Id>,
    pub times_carried: i32,
    pub tasks_total: i32,
    pub tasks_done: i32,
    pub tracked_seconds: Seconds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Week {
    pub start_date: Date,
    pub felt: Option<i32>,
    pub step: i32,
    pub reviewed_at: Option<Timestamp>,
    pub notes: WeekNotes,
    pub outcomes: Vec<Outcome>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct WeekSummary {
    pub start_date: Date,
    pub felt: Option<i32>,
    pub step: i32,
    pub reviewed_at: Option<Timestamp>,
    pub outcomes_total: i32,
    pub outcomes_achieved: i32,
    pub tracked_seconds: Seconds,
    pub planned_seconds: Seconds,
    pub tasks_completed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Priority {
    pub id: Id,
    pub title: String,
    pub note: String,
    pub achieved: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Quarter {
    pub id: Id,
    pub label: String,
    pub start_date: Date,
    pub week_no: i32,
    pub priorities: Vec<Priority>,
}
