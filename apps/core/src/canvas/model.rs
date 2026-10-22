use serde::{Deserialize, Serialize};

use crate::types::{Id, Timestamp};

pub const MAX_CONTENT: usize = 2_000_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ProjectCanvas {
    pub project_id: Id,
    pub content: String,
    pub updated_at: Option<Timestamp>,
}
