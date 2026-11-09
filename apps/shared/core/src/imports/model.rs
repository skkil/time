use serde::{Deserialize, Serialize};

use crate::tasks::TaskInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ImportTask {
    pub task: TaskInput,
    pub children: Vec<ImportTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ImportSection {
    pub name: String,
    pub tasks: Vec<ImportTask>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ImportProject {
    pub name: String,
    pub color: String,
    pub tasks: Vec<ImportTask>,
    pub sections: Vec<ImportSection>,
}
