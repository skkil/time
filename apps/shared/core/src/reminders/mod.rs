//! What to remind about between two moments: timed tasks at their time, focus
//! blocks as they start and events a little before. Each reminder has a
//! stable key so a host can fire or schedule it once; showing it is the
//! host's job, and which kinds a device shows is a device setting.

#[cfg(test)]
mod tests;

use chrono::{Local, TimeZone};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::env::MutationEnv;
use crate::error::Result;
use crate::types::{Date, Id, Timestamp};
use crate::{device_settings, settings, workflow};

const ENABLED_SETTING: &str = "reminders_enabled";
const DEVICE_SETTING: &str = "notifications";
const DEVICE_TASKS: &str = "notify_tasks";
const DEVICE_BLOCKS: &str = "notify_blocks";
const DEVICE_EVENTS: &str = "notify_events";
pub const EVENT_LEAD_MINUTES: i64 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum ReminderKind {
    Task,
    Block,
    Event,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub key: String,
    pub kind: ReminderKind,
    pub at: Timestamp,
    pub title: String,
    pub starts_at: Timestamp,
    pub task_id: Id,
    pub block_id: Option<Id>,
    pub location: String,
}

/// Which reminders this device shows. `on` is the device's own switch; the
/// account-wide `reminders_enabled` setting still turns every device off.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct NotificationPrefs {
    pub on: bool,
    pub tasks: bool,
    pub blocks: bool,
    pub events: bool,
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            on: true,
            tasks: true,
            blocks: true,
            events: true,
        }
    }
}

pub fn enabled(conn: &Connection) -> Result<bool> {
    settings::switch_on(conn, ENABLED_SETTING)
}

pub fn set_enabled(conn: &Connection, env: &dyn MutationEnv, enabled: bool) -> Result<()> {
    settings::set_switch(conn, env, ENABLED_SETTING, enabled)
}

pub fn device_prefs(conn: &Connection) -> Result<NotificationPrefs> {
    Ok(NotificationPrefs {
        on: device_settings::switch_on(conn, DEVICE_SETTING)?,
        tasks: device_settings::switch_on(conn, DEVICE_TASKS)?,
        blocks: device_settings::switch_on(conn, DEVICE_BLOCKS)?,
        events: device_settings::switch_on(conn, DEVICE_EVENTS)?,
    })
}

pub fn set_device_prefs(conn: &Connection, prefs: &NotificationPrefs) -> Result<()> {
    device_settings::set_switch(conn, DEVICE_SETTING, prefs.on)?;
    device_settings::set_switch(conn, DEVICE_TASKS, prefs.tasks)?;
    device_settings::set_switch(conn, DEVICE_BLOCKS, prefs.blocks)?;
    device_settings::set_switch(conn, DEVICE_EVENTS, prefs.events)
}

fn local_date(at: Timestamp) -> Date {
    let moment = Local
        .timestamp_opt(at.0, 0)
        .earliest()
        .expect("a timestamp is a moment");
    Date(moment.date_naive())
}

/// Reminders due after `from` and up to `to`, in time order, of the kinds
/// `prefs` asks for. Nothing while reminders are off for the account or the
/// device.
pub fn upcoming(
    conn: &Connection,
    from: Timestamp,
    to: Timestamp,
    prefs: &NotificationPrefs,
) -> Result<Vec<Reminder>> {
    if !prefs.on || !enabled(conn)? || to <= from {
        return Ok(Vec::new());
    }
    let within = |at: Timestamp| from < at && at <= to;
    let mut found = Vec::new();
    if prefs.tasks {
        let mut stmt = conn.prepare(
            "SELECT t.id, t.title, t.due_date, t.due_time FROM task t
             LEFT JOIN item_type ty ON ty.id = t.type_id
             LEFT JOIN project p ON p.id = t.project_id
             WHERE t.due_date BETWEEN ?1 AND ?2 AND t.due_time IS NOT NULL
               AND t.completed_at IS NULL AND t.someday = 0
               AND COALESCE(ty.kind, 'task') = 'task'
               AND (p.id IS NULL OR p.archived = 0)",
        )?;
        let rows = stmt.query_map(
            params![local_date(from).add_days(-1), local_date(to).add_days(1)],
            |row| {
                Ok((
                    row.get::<_, Id>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Date>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )?;
        for row in rows {
            let (task_id, title, day, minute) = row?;
            let at = Timestamp(day.start().0 + minute * 60);
            if within(at) {
                found.push(Reminder {
                    key: format!("task:{task_id}:{day} {minute}"),
                    kind: ReminderKind::Task,
                    at,
                    title,
                    starts_at: at,
                    task_id,
                    block_id: None,
                    location: String::new(),
                });
            }
        }
    }
    if prefs.blocks {
        let mut stmt = conn.prepare(
            "SELECT b.id, b.task_id, t.title, b.start_at FROM time_block b
             JOIN task t ON t.id = b.task_id
             WHERE b.start_at > ?1 AND b.start_at <= ?2
               AND t.completed_at IS NULL AND t.someday = 0",
        )?;
        let rows = stmt.query_map(params![from, to], |row| {
            Ok((
                row.get::<_, Id>(0)?,
                row.get::<_, Id>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Timestamp>(3)?,
            ))
        })?;
        for row in rows {
            let (block_id, task_id, title, at) = row?;
            found.push(Reminder {
                key: format!("block:{block_id}:{}", at.0),
                kind: ReminderKind::Block,
                at,
                title,
                starts_at: at,
                task_id,
                block_id: Some(block_id),
                location: String::new(),
            });
        }
    }
    if prefs.events {
        let lead = EVENT_LEAD_MINUTES * 60;
        let first = local_date(Timestamp(from.0 + lead)).add_days(-1);
        let last = local_date(Timestamp(to.0 + lead)).add_days(2);
        for event in workflow::occurrences(conn, first, last)? {
            let at = Timestamp(event.start_at.0 - lead);
            if within(at) {
                found.push(Reminder {
                    key: format!("event:{}:{}", event.task_id, event.start_at.0),
                    kind: ReminderKind::Event,
                    at,
                    title: event.title,
                    starts_at: event.start_at,
                    task_id: event.task_id,
                    block_id: None,
                    location: event.location,
                });
            }
        }
    }
    found.sort_by(|a, b| a.at.cmp(&b.at).then_with(|| a.key.cmp(&b.key)));
    Ok(found)
}
