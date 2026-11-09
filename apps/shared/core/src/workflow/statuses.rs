use rusqlite::{Connection, params};

use super::model::StatusInput;
use super::queries::{get_status, next_position};
use super::reconcile::{reconcile, sync_completion};
use super::rules::check_status;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::projects;
use crate::types::Id;

pub(super) fn insert_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &StatusInput,
    position: i32,
) -> Result<Id> {
    let id = env.next_id();
    conn.execute(
        "INSERT INTO item_status (id, project_id, name, category, position)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, project_id, input.name, input.category, position],
    )?;
    Ok(id)
}

pub fn create_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &StatusInput,
) -> Result<Id> {
    projects::get(conn, project_id)?;
    let input = check_status(input)?;
    let position = next_position(conn, "item_status", project_id)?;
    let id = insert_status(conn, env, project_id, &input, position)?;
    reconcile(conn)?;
    Ok(id)
}

pub fn update_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    input: &StatusInput,
) -> Result<()> {
    get_status(conn, id)?;
    let input = check_status(input)?;
    conn.execute(
        "UPDATE item_status SET name = ?1, category = ?2 WHERE id = ?3",
        params![input.name, input.category, id],
    )?;
    sync_completion(conn, env, "status_id = ?1", params![id])
}

pub fn reorder_status(conn: &Connection, id: &Id, before: Option<&Id>) -> Result<()> {
    let current = get_status(conn, id)?;
    let mut ids: Vec<Id> = conn
        .prepare(
            "SELECT id FROM item_status WHERE project_id = ?1 AND id != ?2 ORDER BY position, id",
        )?
        .query_map(params![current.project_id, id], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    let at = before
        .and_then(|before| ids.iter().position(|other| other == before))
        .unwrap_or(ids.len());
    ids.insert(at, id.clone());
    for (position, status) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE item_status SET position = ?1 WHERE id = ?2",
            params![position as i64, status],
        )?;
    }
    Ok(())
}

/// Deletes a status, moving its items to `replacement`. Items may only lose
/// their status when it is the project's last one.
pub fn delete_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    replacement: Option<&Id>,
) -> Result<()> {
    let current = get_status(conn, id)?;
    let used: i64 = conn.query_row(
        "SELECT COUNT(*) FROM task WHERE status_id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    if let Some(other) = replacement {
        let target = get_status(conn, other)?;
        if target.project_id != current.project_id || other == id {
            return Err(Error::invalid("Pick another status from the same project."));
        }
    } else if used > 0 {
        let others: i64 = conn.query_row(
            "SELECT COUNT(*) FROM item_status WHERE project_id = ?1 AND id != ?2",
            params![current.project_id, id],
            |row| row.get(0),
        )?;
        if others > 0 {
            return Err(Error::invalid("Choose where its items go first."));
        }
    }
    conn.execute(
        "UPDATE task SET status_id = ?1, status_changed_at = ?2 WHERE status_id = ?3",
        params![replacement, env.timestamp(), id],
    )?;
    conn.execute("DELETE FROM item_status WHERE id = ?1", params![id])?;
    sync_completion(conn, env, "project_id = ?1", params![current.project_id])
}
