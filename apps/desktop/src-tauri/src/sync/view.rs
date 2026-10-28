use serde::{Deserialize, Serialize};
use specta::Type;
use time_core::sync::Issue;

/// The signed-in person, from the ID token.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AccountView {
    pub name: Option<String>,
    pub email: Option<String>,
}

/// What sync is doing right now.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SyncPhase {
    SignedOut,
    SigningIn,
    Idle,
    Syncing,
    Offline,
    NeedsSignIn,
    NeedsChoice,
}

/// Everything the Sync settings and the connection notice show.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncView {
    pub phase: SyncPhase,
    pub account: Option<AccountView>,
    pub pending: u32,
    /// Unix milliseconds of the last applied pull.
    #[specta(type = Option<specta_typescript::Number>)]
    pub last_synced_at: Option<i64>,
    pub issues: u32,
    pub error: Option<String>,
}

/// A change the server refused, for the "Couldn't apply" list.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncIssueView {
    #[specta(type = specta_typescript::Number)]
    pub id: i64,
    pub name: String,
    pub subject: Option<String>,
    pub reason: String,
    /// Unix milliseconds.
    #[specta(type = specta_typescript::Number)]
    pub created_at: i64,
}

impl From<Issue> for SyncIssueView {
    fn from(issue: Issue) -> Self {
        Self {
            id: issue.id,
            name: issue.name,
            subject: issue.subject,
            reason: issue.reason,
            created_at: issue.created_at,
        }
    }
}

/// What to do with this desktop's data when it signs in to an account it
/// doesn't belong to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum AccountChoice {
    KeepLocal,
    StartFresh,
}

/// Rows of synced tables changed by a pull, for coarse UI refreshes.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RemoteChange {
    pub tables: Vec<String>,
}
