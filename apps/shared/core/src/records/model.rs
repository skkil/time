use serde::{Deserialize, Serialize};

use crate::types::Id;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RecordPhase {
    pub status_id: Id,
    pub notes: String,
}
