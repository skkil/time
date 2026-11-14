//! Saved places a task can happen at. Deleting a place only clears it from
//! its tasks.

mod model;
mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use model::Place;
pub use queries::{get, list};
pub use service::*;
