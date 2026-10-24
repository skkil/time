use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::Project;
use crate::error::{Error, Result};
use crate::types::Id;

const SELECT: &str =
    "SELECT id, parent_id, name, color, position, archived, view, group_id, status,
       outcome, weekly_minutes, target_date, kill_criteria, review_every_weeks, last_reviewed_at,
       in_order, preset, milestone_label
     FROM project";

fn from_row(row: &Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        name: row.get(2)?,
        color: row.get(3)?,
        position: row.get(4)?,
        archived: row.get(5)?,
        view: row.get(6)?,
        group_id: row.get(7)?,
        status: row.get(8)?,
        outcome: row.get(9)?,
        weekly_minutes: row.get(10)?,
        target_date: row.get(11)?,
        kill_criteria: row.get(12)?,
        review_every_weeks: row.get(13)?,
        last_reviewed_at: row.get(14)?,
        in_order: row.get(15)?,
        preset: row.get(16)?,
        milestone_label: row.get(17)?,
    })
}

pub fn get(conn: &Connection, id: &Id) -> Result<Project> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Project"))
}

pub fn list(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY position, id"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn depth(conn: &Connection, id: &Id) -> Result<i64> {
    Ok(conn.query_row(
        "WITH RECURSIVE up(id, parent_id, depth) AS (
           SELECT id, parent_id, 1 FROM project WHERE id = ?1
           UNION ALL
           SELECT p.id, p.parent_id, up.depth + 1 FROM project p JOIN up ON p.id = up.parent_id
         )
         SELECT MAX(depth) FROM up",
        params![id],
        |row| row.get(0),
    )?)
}

/// The project and everything nested under it, each with its depth below
/// the project (the project itself is 1).
pub fn subtree(conn: &Connection, id: &Id) -> Result<Vec<(Id, i64)>> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE down(id, depth) AS (
           SELECT id, 1 FROM project WHERE id = ?1
           UNION ALL
           SELECT p.id, down.depth + 1 FROM project p JOIN down ON p.parent_id = down.id
         )
         SELECT id, depth FROM down",
    )?;
    let rows = stmt.query_map(params![id], |row| Ok((row.get(0)?, row.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
