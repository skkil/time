use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::TimeBlock;
use crate::error::{Error, Result};
use crate::types::{Date, Id};

const SELECT: &str =
    "SELECT b.id, b.task_id, t.title, t.project_id, t.priority, t.completed_at IS NOT NULL,
       b.start_at, b.end_at
     FROM time_block b JOIN task t ON t.id = b.task_id";

fn from_row(row: &Row) -> rusqlite::Result<TimeBlock> {
    Ok(TimeBlock {
        id: row.get(0)?,
        task_id: row.get(1)?,
        title: row.get(2)?,
        project_id: row.get(3)?,
        priority: row.get(4)?,
        completed: row.get(5)?,
        start_at: row.get(6)?,
        end_at: row.get(7)?,
    })
}

pub fn get(conn: &Connection, id: &Id) -> Result<TimeBlock> {
    conn.query_row(&format!("{SELECT} WHERE b.id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Time block"))
}

/// Blocks starting on or after `from` and before `to`.
pub fn list(conn: &Connection, from: Date, to: Date) -> Result<Vec<TimeBlock>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT} WHERE b.start_at >= ?1 AND b.start_at < ?2 ORDER BY b.start_at"
    ))?;
    let rows = stmt.query_map(params![from.start(), to.start()], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
