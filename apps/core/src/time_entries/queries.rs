use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::{TimeEntry, TrackedEntry};
use crate::error::{Error, Result};
use crate::types::{Date, Id};

const SELECT: &str =
    "SELECT id, description, project_id, task_id, started_at, ended_at FROM time_entry";

fn from_row(row: &Row) -> rusqlite::Result<TimeEntry> {
    Ok(TimeEntry {
        id: row.get(0)?,
        description: row.get(1)?,
        project_id: row.get(2)?,
        task_id: row.get(3)?,
        started_at: row.get(4)?,
        ended_at: row.get(5)?,
    })
}

const SELECT_TRACKED: &str = "SELECT e.id, e.description, e.project_id, e.task_id, e.started_at,
       e.ended_at, t.title, t.completed_at IS NOT NULL
     FROM time_entry e
     LEFT JOIN task t ON t.id = e.task_id";

fn tracked_from_row(row: &Row) -> rusqlite::Result<TrackedEntry> {
    Ok(TrackedEntry {
        entry: from_row(row)?,
        task_title: row.get(6)?,
        task_completed: row.get(7)?,
    })
}

pub fn get(conn: &Connection, id: &Id) -> Result<TimeEntry> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Time entry"))
}

/// Every entry overlapping `from..to`; totals clip to the range themselves.
pub fn list(conn: &Connection, from: Date, to: Date) -> Result<Vec<TimeEntry>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT} WHERE started_at < ?2 AND ended_at > ?1 ORDER BY started_at DESC"
    ))?;
    let rows = stmt.query_map(params![from.start(), to.start()], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// The whole history of a task and its sub-tasks.
pub fn list_for_task(conn: &Connection, task_id: &Id) -> Result<Vec<TrackedEntry>> {
    let mut stmt = conn.prepare(&format!(
        "WITH RECURSIVE down(id) AS (
           SELECT ?1
           UNION ALL
           SELECT child.id FROM task child JOIN down ON child.parent_id = down.id
         )
         {SELECT_TRACKED}
         WHERE e.task_id IN (SELECT id FROM down)
         ORDER BY e.started_at DESC"
    ))?;
    let rows = stmt.query_map(params![task_id], tracked_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// The whole history of a project and its sub-projects, following a linked
/// task's current project.
pub fn list_for_project(conn: &Connection, project_id: &Id) -> Result<Vec<TrackedEntry>> {
    let mut stmt = conn.prepare(&format!(
        "WITH RECURSIVE down(id) AS (
           SELECT ?1
           UNION ALL
           SELECT child.id FROM project child JOIN down ON child.parent_id = down.id
         )
         {SELECT_TRACKED}
         WHERE CASE WHEN e.task_id IS NULL THEN e.project_id ELSE t.project_id END
               IN (SELECT id FROM down)
         ORDER BY e.started_at DESC"
    ))?;
    let rows = stmt.query_map(params![project_id], tracked_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
