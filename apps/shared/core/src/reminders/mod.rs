//! Which timed tasks are due for a reminder. Each fires once per date and
//! time, remembered in `task.reminded_for`; showing it is the host's job.

#[cfg(test)]
mod tests;

use rusqlite::{Connection, params};

use crate::env::MutationEnv;
use crate::error::Result;
use crate::settings;
use crate::types::{Date, Id};

const ENABLED_SETTING: &str = "reminders_enabled";
pub const GRACE_MINUTES: i32 = 10;

#[derive(Debug, PartialEq)]
pub struct Reminder {
    pub task_id: Id,
    pub title: String,
    pub minute: i32,
}

pub fn enabled(conn: &Connection) -> Result<bool> {
    settings::switch_on(conn, ENABLED_SETTING)
}

pub fn set_enabled(conn: &Connection, env: &dyn MutationEnv, enabled: bool) -> Result<()> {
    settings::set_switch(conn, env, ENABLED_SETTING, enabled)
}

/// Open tasks due on `today` within the last few minutes before `minute`
/// that have not fired for this date and time, marked as fired.
pub fn take_due(conn: &mut Connection, today: Date, minute: i32) -> Result<Vec<Reminder>> {
    let tx = conn.transaction()?;
    let due = {
        let mut stmt = tx.prepare(
            "SELECT id, title, due_time FROM task
             WHERE due_date = ?1
               AND due_time BETWEEN ?2 AND ?3
               AND completed_at IS NULL
               AND someday = 0
               AND reminded_for IS NOT (due_date || ' ' || due_time)",
        )?;
        stmt.query_map(params![today, minute - GRACE_MINUTES, minute], |row| {
            Ok(Reminder {
                task_id: row.get(0)?,
                title: row.get(1)?,
                minute: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?
    };
    for reminder in &due {
        tx.execute(
            "UPDATE task SET reminded_for = due_date || ' ' || due_time WHERE id = ?1",
            params![reminder.task_id],
        )?;
    }
    tx.commit()?;
    Ok(due)
}
