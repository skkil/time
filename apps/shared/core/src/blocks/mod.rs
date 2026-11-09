//! Planned spans for a task on the schedule grid.

mod model;
mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use model::{BlockSpan, TimeBlock};
pub use queries::{get, list};
pub use service::*;
