use serde::{Deserialize, Serialize};

use crate::types::Id;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: Id,
    pub project_id: Option<Id>,
    pub name: String,
    pub position: i32,
    pub collapsed: bool,
}
