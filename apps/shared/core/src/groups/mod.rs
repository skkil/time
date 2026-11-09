//! Named sets of top-level projects. Deleting a group only clears it from
//! its projects.

mod model;
mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use model::Group;
pub use queries::{get, list};
pub use service::*;
