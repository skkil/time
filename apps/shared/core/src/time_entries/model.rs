use serde::{Deserialize, Serialize};

use crate::types::{Id, Timestamp};

pub const MAX_ENTRY_SECONDS: i64 = Timestamp::DAY;
pub const FUTURE_TOLERANCE_SECONDS: i64 = 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TimeEntry {
    pub id: Id,
    pub description: String,
    pub project_id: Option<Id>,
    pub task_id: Option<Id>,
    pub started_at: Timestamp,
    pub ended_at: Timestamp,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TrackedEntry {
    #[serde(flatten)]
    pub entry: TimeEntry,
    pub task_title: Option<String>,
    pub task_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct EntryDetails {
    pub description: String,
    pub project_id: Option<Id>,
    pub task_id: Option<Id>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    #[serde(flatten)]
    pub details: EntryDetails,
    pub started_at: Timestamp,
    pub ended_at: Timestamp,
}

/// The one running (or paused) focus session. `banked_seconds` is what
/// earlier stretches of the session already logged.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RunningTimer {
    pub description: String,
    pub project_id: Option<Id>,
    pub task_id: Option<Id>,
    pub started_at: Timestamp,
    pub paused_at: Option<Timestamp>,
    #[cfg_attr(feature = "specta", specta(type = specta_typescript::Number))]
    pub banked_seconds: i64,
}
