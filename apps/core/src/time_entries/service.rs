use rusqlite::{Connection, params};

use super::model::{EntryInput, TimeEntry};
use super::queries::get;
use super::rules::{resolve, validate_span};
use crate::env::MutationEnv;
use crate::error::Result;
use crate::types::Id;
use crate::validate::ensure_changed;

pub fn create(conn: &Connection, env: &dyn MutationEnv, input: &EntryInput) -> Result<TimeEntry> {
    validate_span(input.started_at, input.ended_at, env.timestamp())?;
    let details = resolve(conn, &input.details)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO time_entry (id, description, project_id, task_id, started_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            details.description,
            details.project_id,
            details.task_id,
            input.started_at,
            input.ended_at
        ],
    )?;
    get(conn, &id)
}

pub fn update(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    input: &EntryInput,
) -> Result<TimeEntry> {
    validate_span(input.started_at, input.ended_at, env.timestamp())?;
    let details = resolve(conn, &input.details)?;
    let rows = conn.execute(
        "UPDATE time_entry
         SET description = ?1, project_id = ?2, task_id = ?3, started_at = ?4, ended_at = ?5
         WHERE id = ?6",
        params![
            details.description,
            details.project_id,
            details.task_id,
            input.started_at,
            input.ended_at,
            id
        ],
    )?;
    ensure_changed(rows, "Time entry")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM time_entry WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Time entry")
}
