use serde::{Deserialize, Serialize};

use crate::types::{Id, Timestamp};

pub const MINUTE: i64 = 60;
pub const MAX_BLOCK_SECONDS: i64 = Timestamp::DAY;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TimeBlock {
    pub id: Id,
    pub task_id: Id,
    pub title: String,
    pub project_id: Option<Id>,
    pub priority: i32,
    pub completed: bool,
    pub start_at: Timestamp,
    pub end_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct BlockSpan {
    pub start_at: Timestamp,
    pub end_at: Timestamp,
}
