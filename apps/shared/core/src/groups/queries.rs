use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::Group;
use crate::error::{Error, Result};
use crate::types::Id;

const SELECT: &str = "SELECT id, name, position FROM project_group";

fn from_row(row: &Row) -> rusqlite::Result<Group> {
    Ok(Group {
        id: row.get(0)?,
        name: row.get(1)?,
        position: row.get(2)?,
    })
}

pub fn get(conn: &Connection, id: &Id) -> Result<Group> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Group"))
}

pub fn list(conn: &Connection) -> Result<Vec<Group>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY position, name"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn name_taken(conn: &Connection, name: &str, except: Option<&Id>) -> Result<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM project_group WHERE name = ?1 AND id IS NOT ?2)",
        params![name, except],
        |row| row.get(0),
    )?)
}
