//! time-core for React Native: one [`TimeCore`] object over
//! `time_core::sync::Engine`, exported through uniffi and turned into a
//! Turbo Module by uniffi-bindgen-react-native.
//!
//! The engine lives on its own thread ([`worker`]). Commands (`mutate`,
//! `query`) and the account steps are async, so the JS thread never waits
//! for SQLite; the store `CoreHandle` calls are synchronous because the
//! TypeScript sync driver calls them that way, and each touches at most
//! one push or pull page.

mod error;
mod handle;
#[cfg(test)]
mod tests;
mod types;
mod worker;

pub use error::CoreError;
pub use handle::{TimeCore, open};
pub use types::{PullApplied, SignInOutcome, SyncIssue, SyncState};

uniffi::setup_scaffolding!();
