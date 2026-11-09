//! Nested projects (at most three levels) with their settings; archiving and
//! deleting reach the whole subtree.

mod model;
mod queries;
mod rules;
mod service;
#[cfg(test)]
mod tests;

pub use model::*;
pub use queries::{depth, get, list, subtree};
pub use service::*;
