use serde::{Deserialize, Serialize};

use crate::types::{Date, Id, Seconds, Timestamp};

pub const MAX_ESTIMATE_MINUTES: i32 = 24 * 60;
pub const COMPLETED_HISTORY_DAYS: i64 = 14;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: Id,
    pub title: String,
    pub notes: String,
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub priority: i32,
    pub due_date: Option<Date>,
    pub due_time: Option<i32>,
    pub deadline: Option<Date>,
    pub recurrence: Option<String>,
    pub estimate_minutes: Option<i32>,
    pub position: i32,
    pub completed_at: Option<Timestamp>,
    pub created_at: Timestamp,
    pub tracked_seconds: Seconds,
    pub outcome_id: Option<Id>,
    pub rollover_count: i32,
    pub someday: bool,
    pub next_step: String,
    pub must_on: Option<Date>,
    pub type_id: Option<Id>,
    pub status_id: Option<Id>,
    pub milestone_id: Option<Id>,
    pub location: String,
    pub counts_as_time: bool,
    pub status_changed_at: Option<Timestamp>,
    pub kind: String,
    pub status_category: Option<String>,
    pub blocked_by: Vec<Id>,
    pub waiting_on: Vec<Id>,
    pub phase_id: Option<Id>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub notes: String,
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub priority: i32,
    pub due_date: Option<Date>,
    pub due_time: Option<i32>,
    pub deadline: Option<Date>,
    pub recurrence: Option<String>,
    pub estimate_minutes: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TaskPlacement {
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub before: Option<Id>,
}
