//! skkil time's domain, shared by every app: types, validation and rules,
//! SQLite storage with its migrations, and the registry that applies every
//! write command as a named mutation.
//!
//! Writes take the connection (run them inside a transaction) and a
//! [`env::MutationEnv`] for their clock and new ids; reads take only the
//! connection.

pub mod db;
pub mod env;
pub mod error;
pub mod recurrence;
pub mod settings;
pub mod types;

pub mod blocks;
pub mod canvas;
pub mod dependencies;
pub mod groups;
pub mod habits;
pub mod imports;
pub mod mutations;
pub mod projects;
pub mod records;
pub mod reminders;
pub mod review;
pub mod rituals;
pub mod sections;
pub mod tasks;
pub mod time_entries;
pub mod undo;
pub mod workflow;

#[cfg(test)]
mod testing;
mod validate;

pub use error::{Error, Result};
