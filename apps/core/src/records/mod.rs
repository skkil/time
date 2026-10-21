//! Records: long-lived items whose status is their current phase, with a
//! note per phase and sub-tasks tagged by phase.

mod model;
mod rules;
mod service;
#[cfg(test)]
mod tests;

pub use model::RecordPhase;
pub use service::*;
