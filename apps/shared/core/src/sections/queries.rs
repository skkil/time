use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::Section;
use crate::error::{Error, Result};
use crate::types::Id;

const SELECT: &str = "SELECT id, project_id, name, position, collapsed FROM section";

fn from_row(row: &Row) -> rusqlite::Result<Section> {
    Ok(Section {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        position: row.get(3)?,
        collapsed: row.get(4)?,
    })
}

pub fn get(conn: &Connection, id: &Id) -> Result<Section> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Section"))
}

pub fn list(conn: &Connection) -> Result<Vec<Section>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY position, id"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn siblings(conn: &Connection, project_id: Option<&Id>, except: &Id) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM section WHERE project_id IS ?1 AND id IS NOT ?2 ORDER BY position, id",
    )?;
    let rows = stmt.query_map(params![project_id, except], |row| row.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
