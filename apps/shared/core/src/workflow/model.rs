use serde::{Deserialize, Serialize};

use crate::types::{Date, Id, Seconds, Timestamp};

pub const CATEGORIES: [&str; 5] = ["backlog", "todo", "active", "done", "dropped"];
pub const KINDS: [&str; 3] = ["task", "event", "record"];
pub const LAYOUTS: [&str; 4] = ["list", "board", "calendar", "table"];
pub const GROUPS: [&str; 6] = ["section", "type", "status", "milestone", "date", "none"];
pub const SORTS: [&str; 6] = ["manual", "date", "deadline", "priority", "title", "created"];
pub const ICONS: [&str; 24] = [
    "circle",
    "square",
    "sparkles",
    "bug",
    "wrench",
    "git-pull-request",
    "users",
    "repeat",
    "book-open",
    "file-text",
    "pencil",
    "graduation-cap",
    "clipboard-check",
    "timer",
    "flag",
    "mail",
    "phone",
    "briefcase",
    "calendar",
    "target",
    "lightbulb",
    "bookmark",
    "message-circle",
    "presentation",
];
pub const DEFAULT_EVENT_MINUTES: i64 = 60;
pub const MAX_CHECKLIST: usize = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ItemType {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub icon: String,
    pub kind: String,
    pub default_minutes: Option<i32>,
    pub checklist: String,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ItemTypeInput {
    pub name: String,
    pub icon: String,
    pub kind: String,
    pub default_minutes: Option<i32>,
    pub checklist: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ItemStatus {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub category: String,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct StatusInput {
    pub name: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Milestone {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub date: Option<Date>,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct MilestoneInput {
    pub name: String,
    pub date: Option<Date>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct SavedView {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub layout: String,
    pub group_by: String,
    pub filter: String,
    pub sort: String,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ViewInput {
    pub name: String,
    pub layout: String,
    pub group_by: String,
    pub filter: String,
    pub sort: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub types: Vec<ItemType>,
    pub statuses: Vec<ItemStatus>,
    pub milestones: Vec<Milestone>,
    pub views: Vec<SavedView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub key: String,
    pub name: String,
    pub description: String,
    pub types: Vec<ItemTypeInput>,
    pub statuses: Vec<StatusInput>,
    pub milestone_label: String,
    pub views: Vec<ViewInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct EventOccurrence {
    pub task_id: Id,
    pub title: String,
    pub project_id: Option<Id>,
    pub type_id: Option<Id>,
    pub start_at: Timestamp,
    pub end_at: Timestamp,
    pub location: String,
    pub counts_as_time: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TypeTime {
    pub name: String,
    pub icon: String,
    pub seconds: Seconds,
}
