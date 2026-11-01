use time_core::sync::{Issue, PullOutcome, SignIn, SyncStatus};

/// What signing in did with this device's data.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Enum)]
pub enum SignInOutcome {
    /// The device already belongs to this account.
    Synced,
    /// First sign-in: the device's rows are queued for upload.
    Uploading { rows: u64 },
    /// The device holds another account's data; the user picks
    /// `keepLocal` or `startFresh`.
    OtherAccount { bound: String },
}

impl From<SignIn> for SignInOutcome {
    fn from(signed_in: SignIn) -> Self {
        match signed_in {
            SignIn::Synced => Self::Synced,
            SignIn::Uploading { rows } => Self::Uploading { rows: rows as u64 },
            SignIn::OtherAccount { bound } => Self::OtherAccount {
                bound: bound.to_string(),
            },
        }
    }
}

/// What applying one pull page did, as store's `CoreHandle` reports it.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct PullApplied {
    pub changed_tables: Vec<String>,
    pub more: bool,
    pub reset: bool,
}

impl From<PullOutcome> for PullApplied {
    fn from(outcome: PullOutcome) -> Self {
        Self {
            changed_tables: outcome.changed_tables,
            more: outcome.more,
            reset: outcome.reset,
        }
    }
}

/// The replica's sync state: what the driver needs plus what the Sync
/// settings show. Times are Unix milliseconds.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct SyncState {
    pub client_id: String,
    pub scope_id: Option<String>,
    pub pending: u64,
    pub issues: u64,
    pub cursor_version: u64,
    pub last_pull_at: Option<i64>,
}

impl From<SyncStatus> for SyncState {
    fn from(status: SyncStatus) -> Self {
        Self {
            client_id: status.client_id.to_string(),
            scope_id: status.scope_id.map(|scope| scope.to_string()),
            pending: status.pending,
            issues: status.open_issues,
            cursor_version: status.cursor_version,
            last_pull_at: status.last_pull_at,
        }
    }
}

/// A change the server refused, for the "Couldn't apply" list.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct SyncIssue {
    pub id: i64,
    pub name: String,
    pub subject: Option<String>,
    pub reason: String,
    pub created_at: i64,
}

impl From<Issue> for SyncIssue {
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
