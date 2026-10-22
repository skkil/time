//! Todoist-shaped tasks: nesting to any depth, sibling order, dates and
//! repeats. Completing, moving or deleting a task reaches every sub-task.

mod model;
mod placement;
mod queries;
mod rules;
mod service;
#[cfg(test)]
mod tests;

pub use model::*;
pub use queries::{descendants, get, list};
pub use service::*;
