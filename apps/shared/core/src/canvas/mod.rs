//! One free-form HTML document per project, deleted with it.

mod model;
mod service;
#[cfg(test)]
mod tests;

pub use model::ProjectCanvas;
pub use service::*;
