//! Whole-account data: which tables sync, wiping them (`deleteAllData`)
//! and copying a device's rows into an account (`importLocal`).

mod local;
mod tables;
#[cfg(test)]
mod tests;
mod wipe;

pub use local::{LocalData, TableRows, dump, import};
pub use tables::{ID_COLUMN, SYNCED_TABLES, is_synced};
pub use wipe::delete_all;
