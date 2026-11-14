use rusqlite::{Connection, params};

use super::model::Group;
use super::queries::{get, list, name_taken};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::Id;
use crate::validate::{ensure_changed, required_text};

fn unique_name(conn: &Connection, name: &str, except: Option<&Id>) -> Result<String> {
    let name = required_text(name, "Name", 80)?;
    if name_taken(conn, &name, except)? {
        return Err(Error::invalid(format!("{name} already exists.")));
    }
    Ok(name)
}

pub fn create(conn: &Connection, env: &dyn MutationEnv, name: &str) -> Result<Group> {
    let name = unique_name(conn, name, None)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO project_group (id, name, position)
         VALUES (?1, ?2, (SELECT COALESCE(MAX(position), 0) + 1 FROM project_group))",
        params![id, name],
    )?;
    get(conn, &id)
}

pub fn rename(conn: &Connection, id: &Id, name: &str) -> Result<Group> {
    let name = unique_name(conn, name, Some(id))?;
    let rows = conn.execute(
        "UPDATE project_group SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    ensure_changed(rows, "Group")?;
    get(conn, id)
}

/// Moves a group before `before` (to the end when `before` is `None` or not a
/// group) and renumbers every group densely.
pub fn reorder(conn: &Connection, id: &Id, before: Option<&Id>) -> Result<Group> {
    get(conn, id)?;
    let mut ids: Vec<Id> = list(conn)?
        .into_iter()
        .map(|group| group.id)
        .filter(|other| other != id)
        .collect();
    let index = before
        .and_then(|before| ids.iter().position(|other| other == before))
        .unwrap_or(ids.len());
    ids.insert(index, id.clone());
    for (position, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE project_group SET position = ?1 WHERE id = ?2",
            params![position as i64 + 1, id],
        )?;
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM project_group WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Group")
}
