use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::env::NaturalKey;
use crate::error::Result;
use crate::types::Id;

/// One ritual as every account starts with it.
pub struct RitualDefault {
    pub kind: &'static str,
    pub enabled: bool,
    pub trigger: &'static str,
    pub at_minute: i32,
    pub weekdays: i32,
    pub steps: &'static str,
}

/// The five rituals, as the server seeds them.
pub const DEFAULTS: [RitualDefault; 5] = [
    RitualDefault {
        kind: "morning",
        enabled: false,
        trigger: "first_open",
        at_minute: 0,
        weekdays: 127,
        steps: "feel,leftovers,pick_musts,timeblock",
    },
    RitualDefault {
        kind: "evening",
        enabled: false,
        trigger: "end_of_day",
        at_minute: 1050,
        weekdays: 127,
        steps: "what_moved,leftovers,habit_check,one_line_note",
    },
    RitualDefault {
        kind: "wind_down",
        enabled: false,
        trigger: "at_time",
        at_minute: 1335,
        weekdays: 127,
        steps: "brain_dump,habit_check,device_away",
    },
    RitualDefault {
        kind: "session",
        enabled: true,
        trigger: "after_timer_stop",
        at_minute: 0,
        weekdays: 127,
        steps: "did_it_move,next_step_note,breathing_pause",
    },
    RitualDefault {
        kind: "weekly",
        enabled: true,
        trigger: "first_open",
        at_minute: 0,
        weekdays: 1,
        steps: "weekly_review",
    },
];

/// The seeded id of the `kind` ritual in an account: `ritual/<kind>`.
pub fn ritual_id(scope: Uuid, kind: &str) -> Id {
    NaturalKey::Ritual(kind).id(scope)
}

/// Puts every ritual back to its defaults in place, keeping its id.
pub fn reset_rituals(conn: &Connection) -> Result<()> {
    for ritual in &DEFAULTS {
        conn.execute(
            "UPDATE ritual SET enabled = ?1, trigger = ?2, at_minute = ?3, weekdays = ?4,
               min_minutes = 20, steps = ?5
             WHERE kind = ?6",
            params![
                ritual.enabled,
                ritual.trigger,
                ritual.at_minute,
                ritual.weekdays,
                ritual.steps,
                ritual.kind
            ],
        )?;
    }
    Ok(())
}
