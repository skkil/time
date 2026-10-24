use rusqlite::{Connection, OptionalExtension, params};

use crate::error::{Error, Result};
use crate::tasks::{self, Task};
use crate::types::Id;

pub fn record(conn: &Connection, id: &Id) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    if task.kind != "record" {
        return Err(Error::invalid("Only records have phases."));
    }
    Ok(task)
}

/// A phase is a status of the record's own project.
pub fn check_phase(conn: &Connection, record: &Task, status_id: &Id) -> Result<()> {
    let project: Option<Id> = conn
        .query_row(
            "SELECT project_id FROM item_status WHERE id = ?1",
            params![status_id],
            |row| row.get(0),
        )
        .optional()?;
    match project {
        None => Err(Error::not_found("Phase")),
        Some(project) if Some(&project) != record.project_id.as_ref() => {
            Err(Error::invalid("That phase belongs to another project."))
        }
        Some(_) => Ok(()),
    }
}
