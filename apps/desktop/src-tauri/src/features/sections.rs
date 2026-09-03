use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::Serialize;
use specta::Type;
use tauri::State;

use super::{ensure_changed, projects, required_text};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::Id;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Section {
    pub id: Id,
    pub project_id: Option<Id>,
    pub name: String,
    pub position: i32,
    pub collapsed: bool,
}

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

pub fn get(conn: &Connection, id: Id) -> Result<Section> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Section"))
}

pub fn list(conn: &Connection) -> Result<Vec<Section>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY position, id"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn siblings(conn: &Connection, project_id: Option<Id>, except: Option<Id>) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM section WHERE project_id IS ?1 AND id IS NOT ?2 ORDER BY position, id",
    )?;
    let rows = stmt.query_map(params![project_id, except], |row| row.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn renumber(conn: &Connection, ids: &[Id]) -> Result<()> {
    for (position, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE section SET position = ?1 WHERE id = ?2",
            params![position as i64 + 1, id],
        )?;
    }
    Ok(())
}

pub fn create(
    conn: &mut Connection,
    project_id: Option<Id>,
    name: &str,
    before: Option<Id>,
) -> Result<Section> {
    let name = required_text(name, "Section name", 120)?;
    if let Some(project_id) = project_id
        && projects::get(conn, project_id)?.archived
    {
        return Err(Error::invalid("Can't add sections to an archived project."));
    }
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO section (project_id, name) VALUES (?1, ?2)",
        params![project_id, name],
    )?;
    let id = Id(tx.last_insert_rowid());
    place(&tx, id, project_id, before)?;
    tx.commit()?;
    get(conn, id)
}

fn place(conn: &Connection, id: Id, project_id: Option<Id>, before: Option<Id>) -> Result<()> {
    let mut ids = siblings(conn, project_id, Some(id))?;
    let index = before
        .and_then(|before| ids.iter().position(|other| *other == before))
        .unwrap_or(ids.len());
    ids.insert(index, id);
    renumber(conn, &ids)
}

pub fn rename(conn: &Connection, id: Id, name: &str) -> Result<Section> {
    let name = required_text(name, "Section name", 120)?;
    let rows = conn.execute(
        "UPDATE section SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    ensure_changed(rows, "Section")?;
    get(conn, id)
}

pub fn set_collapsed(conn: &Connection, id: Id, collapsed: bool) -> Result<Section> {
    let rows = conn.execute(
        "UPDATE section SET collapsed = ?1 WHERE id = ?2",
        params![collapsed, id],
    )?;
    ensure_changed(rows, "Section")?;
    get(conn, id)
}

pub fn reorder(conn: &mut Connection, id: Id, before: Option<Id>) -> Result<Section> {
    let section = get(conn, id)?;
    let tx = conn.transaction()?;
    place(&tx, id, section.project_id, before)?;
    tx.commit()?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM section WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Section")
}

#[tauri::command]
#[specta::specta]
pub async fn list_sections(db: State<'_, Db>) -> Result<Vec<Section>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_section(
    db: State<'_, Db>,
    project_id: Option<Id>,
    name: String,
    before: Option<Id>,
) -> Result<Section> {
    db.call(|conn| create(conn, project_id, &name, before))
}

#[tauri::command]
#[specta::specta]
pub async fn rename_section(db: State<'_, Db>, id: Id, name: String) -> Result<Section> {
    db.call(|conn| rename(conn, id, &name))
}

#[tauri::command]
#[specta::specta]
pub async fn set_section_collapsed(db: State<'_, Db>, id: Id, collapsed: bool) -> Result<Section> {
    db.call(|conn| set_collapsed(conn, id, collapsed))
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_section(db: State<'_, Db>, id: Id, before: Option<Id>) -> Result<Section> {
    db.call(|conn| reorder(conn, id, before))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_section(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orders_and_reorders_inbox_sections() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = create(conn, None, "Backlog", None)?;
            let b = create(conn, None, "Ideas", None)?;
            let c = create(conn, None, "Now", Some(a.id))?;
            let names = |conn: &Connection| -> Result<Vec<String>> {
                Ok(list(conn)?.into_iter().map(|s| s.name).collect())
            };
            assert_eq!(names(conn)?, ["Now", "Backlog", "Ideas"]);
            reorder(conn, c.id, None)?;
            assert_eq!(names(conn)?, ["Backlog", "Ideas", "Now"]);
            reorder(conn, b.id, Some(a.id))?;
            assert_eq!(names(conn)?, ["Ideas", "Backlog", "Now"]);
            Ok(())
        })
        .unwrap();
    }
}
