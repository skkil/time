//! Today at a glance for surfaces outside the main window (the tray, menu bar
//! and home-screen widgets): what is running or happening now, what comes
//! next today, today's musts and how many tasks are left from earlier days.

#[cfg(test)]
mod tests;

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::time_entries::{self, RunningTimer};
use crate::types::{Date, Id, Timestamp};
use crate::workflow;

pub const MAX_MUSTS: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum GlanceKind {
    Block,
    Task,
    Event,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct GlanceItem {
    pub kind: GlanceKind,
    pub title: String,
    pub task_id: Id,
    pub starts_at: Timestamp,
    pub ends_at: Option<Timestamp>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct GlanceTask {
    pub id: Id,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Glance {
    pub timer: Option<RunningTimer>,
    pub now: Option<GlanceItem>,
    pub next: Option<GlanceItem>,
    pub musts: Vec<GlanceTask>,
    pub earlier_count: i32,
}

fn blocks(conn: &Connection, from: Timestamp, to: Timestamp) -> Result<Vec<GlanceItem>> {
    let mut stmt = conn.prepare(
        "SELECT t.title, b.task_id, b.start_at, b.end_at FROM time_block b
         JOIN task t ON t.id = b.task_id
         WHERE b.end_at > ?1 AND b.start_at < ?2 AND t.completed_at IS NULL
         ORDER BY b.start_at, b.id",
    )?;
    let rows = stmt.query_map(params![from, to], |row| {
        Ok(GlanceItem {
            kind: GlanceKind::Block,
            title: row.get(0)?,
            task_id: row.get(1)?,
            starts_at: row.get(2)?,
            ends_at: Some(row.get(3)?),
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn timed_tasks(conn: &Connection, today: Date) -> Result<Vec<GlanceItem>> {
    let mut stmt = conn.prepare(
        "SELECT t.title, t.id, t.due_time FROM task t
         LEFT JOIN item_type ty ON ty.id = t.type_id
         LEFT JOIN project p ON p.id = t.project_id
         WHERE t.due_date = ?1 AND t.due_time IS NOT NULL AND t.completed_at IS NULL
           AND COALESCE(ty.kind, 'task') = 'task'
           AND (p.id IS NULL OR p.archived = 0)
         ORDER BY t.due_time, t.position, t.id",
    )?;
    let rows = stmt.query_map(params![today], |row| {
        Ok(GlanceItem {
            kind: GlanceKind::Task,
            title: row.get(0)?,
            task_id: row.get(1)?,
            starts_at: Timestamp(today.start().0 + row.get::<_, i64>(2)? * 60),
            ends_at: None,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn musts(conn: &Connection, today: Date) -> Result<Vec<GlanceTask>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title FROM task t
         LEFT JOIN project p ON p.id = t.project_id
         WHERE t.must_on = ?1 AND t.completed_at IS NULL AND (p.id IS NULL OR p.archived = 0)
         ORDER BY t.priority, t.position, t.id
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![today, MAX_MUSTS as i64], |row| {
        Ok(GlanceTask {
            id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Open one-off work whose date or window ended before today, as Day's
/// "From earlier days" counts it.
fn earlier_count(conn: &Connection, today: Date) -> Result<i32> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM task t
         LEFT JOIN item_type ty ON ty.id = t.type_id
         LEFT JOIN item_status st ON st.id = t.status_id
         LEFT JOIN project p ON p.id = t.project_id
         WHERE t.completed_at IS NULL
           AND COALESCE(ty.kind, 'task') = 'task'
           AND COALESCE(st.category, '') <> 'backlog'
           AND COALESCE(t.due_until, t.due_date) < ?1
           AND t.must_on IS NOT ?1
           AND (p.id IS NULL OR p.archived = 0)",
        params![today],
        |row| row.get(0),
    )?)
}

pub fn today_glance(conn: &Connection, now: Timestamp, today: Date) -> Result<Glance> {
    let end_of_day = today.add_days(1).start();
    let mut happening = blocks(conn, now, end_of_day)?;
    happening.extend(timed_tasks(conn, today)?);
    happening.extend(
        workflow::occurrences(conn, today, today.add_days(1))?
            .into_iter()
            .filter(|event| event.end_at > now)
            .map(|event| GlanceItem {
                kind: GlanceKind::Event,
                title: event.title,
                task_id: event.task_id,
                starts_at: event.start_at,
                ends_at: Some(event.end_at),
            }),
    );
    happening.sort_by_key(|item| item.starts_at);
    let current = happening
        .iter()
        .find(|item| item.ends_at.is_some() && item.starts_at <= now)
        .cloned();
    let next = happening.into_iter().find(|item| item.starts_at > now);
    Ok(Glance {
        timer: time_entries::running(conn)?,
        now: current,
        next,
        musts: musts(conn, today)?,
        earlier_count: earlier_count(conn, today)?,
    })
}
