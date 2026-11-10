use chrono::{DateTime, FixedOffset, Local, Timelike};
use serde::{Deserialize, Serialize};

use crate::types::{Date, Id, Timestamp};

pub const KINDS: [&str; 5] = ["weekly", "morning", "evening", "wind_down", "session"];
pub const TRIGGERS: [&str; 5] = [
    "first_open",
    "at_time",
    "end_of_day",
    "after_timer_stop",
    "manual",
];
pub const STEPS: [&str; 12] = [
    "feel",
    "what_moved",
    "leftovers",
    "pick_musts",
    "timeblock",
    "one_line_note",
    "habit_check",
    "breathing_pause",
    "next_step_note",
    "did_it_move",
    "brain_dump",
    "device_away",
];
pub const SNOOZE_SECONDS: i64 = 15 * 60;
pub const END_OF_DAY_EARLIEST_BEFORE: i32 = 120;
pub const PLANNING_SETTING: &str = "planning_time";
pub const REVIEW_DAY_SETTING: &str = "review_day";
pub const DEFAULT_REVIEW_DAY: i32 = 6;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Ritual {
    pub kind: String,
    pub enabled: bool,
    pub trigger: String,
    pub at_minute: i32,
    pub weekdays: i32,
    pub min_minutes: i32,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RitualInput {
    pub enabled: bool,
    pub trigger: String,
    pub at_minute: i32,
    pub weekdays: i32,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RitualRun {
    pub id: Id,
    pub kind: String,
    pub date: Date,
    pub task_id: Option<Id>,
    pub started_at: Timestamp,
    pub finished_at: Option<Timestamp>,
    pub skipped: bool,
    pub step: i32,
    pub snoozed_until: Option<Timestamp>,
}

/// A ritual that should open, and the Monday of the week it goes on to close,
/// if any: the evening on the review day, or the next morning's offer. A
/// `weekly` ritual with a week is that weekly part on its own, after a snooze.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct DueRitual {
    pub ritual: Ritual,
    pub week: Option<Date>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum RitualEvent {
    Open,
    Tick,
    TimerStopped { minutes: i32 },
}

/// One instant seen as a local day, minute of that day and timestamp.
#[derive(Debug, Clone, Copy)]
pub struct Moment {
    pub date: Date,
    pub minute: i32,
    pub stamp: Timestamp,
}

impl Moment {
    pub fn at(now: DateTime<FixedOffset>) -> Self {
        Self {
            date: Date(now.date_naive()),
            minute: (now.hour() * 60 + now.minute()) as i32,
            stamp: Timestamp(now.timestamp()),
        }
    }

    pub fn now() -> Self {
        Self::at(Local::now().fixed_offset())
    }
}
