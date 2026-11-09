//! Tracked time and the one running timer. A linked task decides an entry's
//! project; a break logs the stretch so far and resuming starts a new one.

mod model;
mod queries;
mod rules;
mod service;
#[cfg(test)]
mod tests;
mod timer;

pub use model::*;
pub use queries::{get, list, list_for_project, list_for_task};
pub use service::*;
pub use timer::*;
