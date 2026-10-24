//! Sync through skkil store: the [`Engine`] facade every host drives, the
//! [`TimeMutator`] that replays time's mutations inside store, and the
//! first-sign-in upload. Hosts move the bytes: the desktop with
//! `skkil-store-http`, the browser and mobile with `@skkil/store-client`.

mod engine;
mod env;
mod error;
mod issue;
mod mutator;
#[cfg(test)]
mod tests;
mod upload;

pub use engine::{Engine, SignIn};
pub use env::StoreEnv;
pub use issue::Issue;
pub use mutator::TimeMutator;
pub use store_core::{PullOutcome, PushOutcome, SyncStatus, protocol, uuid::Uuid};
