use rusqlite::{Connection, params};

use super::model::Section;
use super::queries::{get, siblings};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::projects;
use crate::types::Id;
use crate::validate::{ensure_changed, required_text};

fn place(conn: &Connection, id: &Id, project_id: Option<&Id>, before: Option<&Id>) -> Result<()> {
    let mut ids = siblings(conn, project_id, id)?;
    let index = before
        .and_then(|before| ids.iter().position(|other| other == before))
        .unwrap_or(ids.len());
    ids.insert(index, id.clone());
    for (position, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE section SET position = ?1 WHERE id = ?2",
            params![position as i64 + 1, id],
        )?;
    }
    Ok(())
}

pub fn create(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: Option<&Id>,
    name: &str,
    before: Option<&Id>,
) -> Result<Section> {
    let name = required_text(name, "Section name", 120)?;
    if let Some(project_id) = project_id
        && projects::get(conn, project_id)?.archived
    {
        return Err(Error::invalid("Can't add sections to an archived project."));
    }
    let id = env.next_id();
    conn.execute(
        "INSERT INTO section (id, project_id, name) VALUES (?1, ?2, ?3)",
        params![id, project_id, name],
    )?;
    place(conn, &id, project_id, before)?;
    get(conn, &id)
}

pub fn rename(conn: &Connection, id: &Id, name: &str) -> Result<Section> {
    let name = required_text(name, "Section name", 120)?;
    let rows = conn.execute(
        "UPDATE section SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    ensure_changed(rows, "Section")?;
    get(conn, id)
}

pub fn set_collapsed(conn: &Connection, id: &Id, collapsed: bool) -> Result<Section> {
    let rows = conn.execute(
        "UPDATE section SET collapsed = ?1 WHERE id = ?2",
        params![collapsed, id],
    )?;
    ensure_changed(rows, "Section")?;
    get(conn, id)
}

pub fn reorder(conn: &Connection, id: &Id, before: Option<&Id>) -> Result<Section> {
    let section = get(conn, id)?;
    place(conn, id, section.project_id.as_ref(), before)?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM section WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Section")
}
