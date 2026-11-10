//! Planned spans for a task on the schedule grid.

mod logging;
mod model;
mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use logging::{
    count_ended, enabled as auto_log_enabled, log_ended, set_enabled as set_auto_log,
};
pub use model::{BlockSpan, TimeBlock};
pub use queries::{get, list};
pub use service::*;
