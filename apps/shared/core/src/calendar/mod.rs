//! Events from connected calendars (Google), shown beside the plan. The
//! server connects accounts and writes `calendar_source` and
//! `calendar_event`; a device only reads them and hides or shows a source.

mod guard;
mod model;
mod queries;
mod service;
#[cfg(test)]
mod tests;

pub use guard::guard;
pub use model::{CalendarEvent, CalendarSource};
pub use queries::{events, get_source, sources};
pub use service::set_visible;
