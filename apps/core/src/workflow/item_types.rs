use rusqlite::{Connection, params};

use super::model::ItemTypeInput;
use super::queries::{get_type, next_position};
use super::rules::check_type;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::projects;
use crate::types::Id;

pub(super) fn insert_type(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &ItemTypeInput,
    position: i32,
) -> Result<Id> {
    let id = env.next_id();
    conn.execute(
        "INSERT INTO item_type (id, project_id, name, icon, kind, default_minutes, checklist,
                                position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            project_id,
            input.name,
            input.icon,
            input.kind,
            input.default_minutes,
            input.checklist,
            position
        ],
    )?;
    Ok(id)
}

pub fn create_type(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &ItemTypeInput,
) -> Result<Id> {
    projects::get(conn, project_id)?;
    let input = check_type(input)?;
    let position = next_position(conn, "item_type", project_id)?;
    insert_type(conn, env, project_id, &input, position)
}

pub fn update_type(conn: &Connection, id: &Id, input: &ItemTypeInput) -> Result<()> {
    let current = get_type(conn, id)?;
    let input = check_type(input)?;
    if current.kind != "event" && input.kind == "event" {
        let untimed: i64 = conn.query_row(
            "SELECT COUNT(*) FROM task WHERE type_id = ?1 AND due_time IS NULL",
            params![id],
            |row| row.get(0),
        )?;
        if untimed > 0 {
            return Err(Error::invalid(
                "Some items of this type have no time yet. Events happen at a time.",
            ));
        }
    }
    conn.execute(
        "UPDATE item_type SET name = ?1, icon = ?2, kind = ?3, default_minutes = ?4, checklist = ?5
         WHERE id = ?6",
        params![
            input.name,
            input.icon,
            input.kind,
            input.default_minutes,
            input.checklist,
            id
        ],
    )?;
    Ok(())
}

/// Deletes a type, moving its items to `replacement` (a type of the same
/// project) or leaving them untyped.
pub fn delete_type(conn: &Connection, id: &Id, replacement: Option<&Id>) -> Result<()> {
    let current = get_type(conn, id)?;
    if let Some(other) = replacement {
        let target = get_type(conn, other)?;
        if target.project_id != current.project_id || other == id {
            return Err(Error::invalid("Pick another type from the same project."));
        }
    }
    conn.execute(
        "UPDATE task SET type_id = ?1 WHERE type_id = ?2",
        params![replacement, id],
    )?;
    conn.execute("DELETE FROM item_type WHERE id = ?1", params![id])?;
    Ok(())
}
