use rusqlite::{Connection, params};

use super::model::Place;
use super::queries::{get, name_taken};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::tasks::{self, Task};
use crate::types::Id;
use crate::validate::{ensure_changed, required_text};

fn unique_name(conn: &Connection, name: &str, except: Option<&Id>) -> Result<String> {
    let name = required_text(name, "Name", 80)?;
    if name_taken(conn, &name, except)? {
        return Err(Error::invalid(format!("{name} already exists.")));
    }
    Ok(name)
}

pub fn create(conn: &Connection, env: &dyn MutationEnv, name: &str) -> Result<Place> {
    let name = unique_name(conn, name, None)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO place (id, name, position)
         VALUES (?1, ?2, (SELECT COALESCE(MAX(position), 0) + 1 FROM place))",
        params![id, name],
    )?;
    get(conn, &id)
}

pub fn rename(conn: &Connection, id: &Id, name: &str) -> Result<Place> {
    let name = unique_name(conn, name, Some(id))?;
    let rows = conn.execute(
        "UPDATE place SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    ensure_changed(rows, "Place")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM place WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Place")
}

pub fn set_task_place(conn: &Connection, id: &Id, place_id: Option<&Id>) -> Result<Task> {
    if let Some(place_id) = place_id {
        get(conn, place_id)?;
    }
    let rows = conn.execute(
        "UPDATE task SET place_id = ?1 WHERE id = ?2",
        params![place_id, id],
    )?;
    ensure_changed(rows, "Task")?;
    tasks::get(conn, id)
}
