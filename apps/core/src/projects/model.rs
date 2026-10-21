use serde::{Deserialize, Serialize};

use crate::types::{Date, Id, Timestamp};

pub const COLORS: [&str; 8] = [
    "graphite", "blue", "teal", "green", "olive", "amber", "rust", "plum",
];
pub const MAX_DEPTH: i64 = 3;
pub const VIEWS: [&str; 2] = ["list", "board"];
pub const STATUSES: [&str; 4] = ["active", "paused", "done", "dropped"];
pub const REVIEW_WEEKS: [i32; 3] = [1, 2, 4];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Id,
    pub parent_id: Option<Id>,
    pub name: String,
    pub color: String,
    pub position: i32,
    pub archived: bool,
    pub view: String,
    pub group_id: Option<Id>,
    pub status: String,
    pub outcome: String,
    pub weekly_minutes: Option<i32>,
    pub target_date: Option<Date>,
    pub kill_criteria: String,
    pub review_every_weeks: i32,
    pub last_reviewed_at: Option<Timestamp>,
    pub in_order: bool,
    pub preset: String,
    pub milestone_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub group_id: Option<Id>,
    pub status: String,
    pub outcome: String,
    pub weekly_minutes: Option<i32>,
    pub target_date: Option<Date>,
    pub kill_criteria: String,
    pub review_every_weeks: i32,
    pub in_order: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    pub parent_id: Option<Id>,
    pub color: String,
}
