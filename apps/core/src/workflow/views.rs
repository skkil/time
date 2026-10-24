use rusqlite::{Connection, params};

use super::model::ViewInput;
use super::queries::next_position;
use super::rules::check_view;
use crate::env::MutationEnv;
use crate::error::Result;
use crate::projects;
use crate::types::Id;
use crate::validate::ensure_changed;

pub(super) fn insert_view(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &ViewInput,
    position: i32,
) -> Result<Id> {
    let id = env.next_id();
    conn.execute(
        "INSERT INTO saved_view (id, project_id, name, layout, group_by, filter, sort, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            project_id,
            input.name,
            input.layout,
            input.group_by,
            input.filter,
            input.sort,
            position
        ],
    )?;
    Ok(id)
}

pub fn create_view(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &ViewInput,
) -> Result<Id> {
    projects::get(conn, project_id)?;
    let input = check_view(input)?;
    let position = next_position(conn, "saved_view", project_id)?;
    insert_view(conn, env, project_id, &input, position)
}

pub fn update_view(conn: &Connection, id: &Id, input: &ViewInput) -> Result<()> {
    let input = check_view(input)?;
    let rows = conn.execute(
        "UPDATE saved_view SET name = ?1, layout = ?2, group_by = ?3, filter = ?4, sort = ?5
         WHERE id = ?6",
        params![
            input.name,
            input.layout,
            input.group_by,
            input.filter,
            input.sort,
            id
        ],
    )?;
    ensure_changed(rows, "View")
}

pub fn delete_view(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM saved_view WHERE id = ?1", params![id])?;
    ensure_changed(rows, "View")
}
