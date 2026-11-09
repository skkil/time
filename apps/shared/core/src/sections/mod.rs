//! Ordered groups inside a project or the Inbox; deleting one deletes its
//! tasks.

mod model;
mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use model::Section;
pub use queries::{get, list};
pub use service::*;
