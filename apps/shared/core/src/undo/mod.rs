//! Undo for task changes: a snapshot of the affected tasks taken before the
//! change. The client keeps it in memory and sends it back as the
//! `restoreTasks` mutation, so an undo syncs like any other change.

mod snapshot;
#[cfg(test)]
mod tests;

pub use snapshot::{SnapshotRows, SnapshotValue, TaskSnapshot, Whole, capture, restore};
