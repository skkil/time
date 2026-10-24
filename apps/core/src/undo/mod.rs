//! Undo for task changes: a snapshot of the affected tasks taken before the
//! change, restored on request. Snapshots live only on the device.

mod log;
mod snapshot;
#[cfg(test)]
mod tests;

pub use log::{KEPT_SNAPSHOTS, UndoLog};
pub use snapshot::{TaskSnapshot, capture, restore};
