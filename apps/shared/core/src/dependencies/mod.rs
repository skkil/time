//! Tasks waiting on other tasks. "Blocked" is derived from open blockers,
//! never stored; loops, self-links and blockers that never finish are refused.

mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use service::*;
