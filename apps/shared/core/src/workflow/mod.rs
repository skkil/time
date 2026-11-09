//! Per-project structure: item types (task, event, record), statuses in
//! fixed categories, milestones, saved views and the presets that set them
//! up together. A closed status and `completed_at` stay in step both ways.

mod catalog;
mod events;
mod item_types;
mod milestones;
mod model;
mod presets;
mod queries;
mod reconcile;
mod rules;
mod statuses;
mod task_fields;
#[cfg(test)]
mod tests;
mod views;

pub use catalog::presets;
pub use events::{counted_event_seconds, occurrences, time_by_type};
pub use item_types::{create_type, delete_type, update_type};
pub use milestones::{create_milestone, delete_milestone, set_milestone_label, update_milestone};
pub use model::*;
pub use presets::{apply_preset, export_preset, parse_preset};
pub use queries::{get_status, get_type, list};
pub use reconcile::{reconcile, status_for_completion};
pub use statuses::{create_status, delete_status, reorder_status, update_status};
pub use task_fields::{set_task_event, set_task_milestone, set_task_status, set_task_type};
pub use views::{create_view, delete_view, update_view};
