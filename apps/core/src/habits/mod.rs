//! Habitify-style habits (build, quit, limit) with daily logs. Status is
//! derived, never stored; tracked habits measure websites, apps or a
//! project's time, and a status the user sets always wins.

pub mod activity;
mod model;
mod queries;
mod rules;
mod service;
mod status;
mod sync;
#[cfg(test)]
mod tests;

pub use model::*;
pub use queries::{active, days, get, list};
pub use service::*;
pub use sync::{
    activity_span, measure_activity, needs_source, project_measurements, record_measurements, tracked,
};
