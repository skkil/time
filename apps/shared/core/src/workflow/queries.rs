use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::{ItemStatus, ItemType, Milestone, SavedView, Workflow};
use crate::error::{Error, Result};
use crate::types::Id;

const SELECT_TYPE: &str =
    "SELECT id, project_id, name, icon, kind, default_minutes, checklist, position FROM item_type";
const SELECT_STATUS: &str = "SELECT id, project_id, name, category, position FROM item_status";

fn type_row(row: &Row) -> rusqlite::Result<ItemType> {
    Ok(ItemType {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        icon: row.get(3)?,
        kind: row.get(4)?,
        default_minutes: row.get(5)?,
        checklist: row.get(6)?,
        position: row.get(7)?,
    })
}

fn status_row(row: &Row) -> rusqlite::Result<ItemStatus> {
    Ok(ItemStatus {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        category: row.get(3)?,
        position: row.get(4)?,
    })
}

fn milestone_row(row: &Row) -> rusqlite::Result<Milestone> {
    Ok(Milestone {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        date: row.get(3)?,
        position: row.get(4)?,
    })
}

fn view_row(row: &Row) -> rusqlite::Result<SavedView> {
    Ok(SavedView {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        layout: row.get(3)?,
        group_by: row.get(4)?,
        filter: row.get(5)?,
        sort: row.get(6)?,
        position: row.get(7)?,
    })
}

pub fn get_type(conn: &Connection, id: &Id) -> Result<ItemType> {
    conn.query_row(
        &format!("{SELECT_TYPE} WHERE id = ?1"),
        params![id],
        type_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Type"))
}

pub fn get_status(conn: &Connection, id: &Id) -> Result<ItemStatus> {
    conn.query_row(
        &format!("{SELECT_STATUS} WHERE id = ?1"),
        params![id],
        status_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Status"))
}

pub fn milestone_project(conn: &Connection, id: &Id) -> Result<Id> {
    conn.query_row(
        "SELECT project_id FROM milestone WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Milestone"))
}

/// Every project's types, statuses, milestones and saved views.
pub fn list(conn: &Connection) -> Result<Workflow> {
    let types = conn
        .prepare(&format!("{SELECT_TYPE} ORDER BY project_id, position, id"))?
        .query_map([], type_row)?
        .collect::<rusqlite::Result<_>>()?;
    let statuses = conn
        .prepare(&format!(
            "{SELECT_STATUS} ORDER BY project_id, position, id"
        ))?
        .query_map([], status_row)?
        .collect::<rusqlite::Result<_>>()?;
    let milestones = conn
        .prepare(
            "SELECT id, project_id, name, date, position
               FROM milestone ORDER BY project_id, date IS NULL, date, position, id",
        )?
        .query_map([], milestone_row)?
        .collect::<rusqlite::Result<_>>()?;
    let views = conn
        .prepare(
            "SELECT id, project_id, name, layout, group_by, filter, sort, position
               FROM saved_view ORDER BY project_id, position, id",
        )?
        .query_map([], view_row)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(Workflow {
        types,
        statuses,
        milestones,
        views,
    })
}

pub fn next_position(conn: &Connection, table: &str, project_id: &Id) -> Result<i32> {
    Ok(conn.query_row(
        &format!("SELECT COALESCE(MAX(position), 0) + 1 FROM {table} WHERE project_id = ?1"),
        params![project_id],
        |row| row.get(0),
    )?)
}
