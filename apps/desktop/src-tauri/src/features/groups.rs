use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::Serialize;
use specta::Type;
use tauri::State;

use super::{ensure_changed, required_text};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::Id;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: Id,
    pub name: String,
    pub position: i32,
}

const SELECT: &str = "SELECT id, name, position FROM project_group";

fn from_row(row: &Row) -> rusqlite::Result<Group> {
    Ok(Group {
        id: row.get(0)?,
        name: row.get(1)?,
        position: row.get(2)?,
    })
}

pub fn get(conn: &Connection, id: Id) -> Result<Group> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Group"))
}

pub fn list(conn: &Connection) -> Result<Vec<Group>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY position, name"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn taken(conn: &Connection, name: &str, except: Option<Id>) -> Result<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM project_group WHERE name = ?1 AND id IS NOT ?2)",
        params![name, except],
        |row| row.get(0),
    )?)
}

pub fn create(conn: &Connection, name: &str) -> Result<Group> {
    let name = required_text(name, "Name", 80)?;
    if taken(conn, &name, None)? {
        return Err(Error::invalid(format!("{name} already exists.")));
    }
    conn.execute(
        "INSERT INTO project_group (name, position)
         VALUES (?1, (SELECT COALESCE(MAX(position), 0) + 1 FROM project_group))",
        params![name],
    )?;
    get(conn, Id(conn.last_insert_rowid()))
}

pub fn rename(conn: &Connection, id: Id, name: &str) -> Result<Group> {
    let name = required_text(name, "Name", 80)?;
    if taken(conn, &name, Some(id))? {
        return Err(Error::invalid(format!("{name} already exists.")));
    }
    let rows = conn.execute(
        "UPDATE project_group SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    ensure_changed(rows, "Group")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM project_group WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Group")
}

#[tauri::command]
#[specta::specta]
pub async fn list_groups(db: State<'_, Db>) -> Result<Vec<Group>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_group(db: State<'_, Db>, name: String) -> Result<Group> {
    db.call(|conn| create(conn, &name))
}

#[tauri::command]
#[specta::specta]
pub async fn rename_group(db: State<'_, Db>, id: Id, name: String) -> Result<Group> {
    db.call(|conn| rename(conn, id, &name))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_group(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::projects;

    #[test]
    fn names_are_unique_and_deleting_frees_projects() {
        let db = Db::in_memory();
        db.call(|conn| {
            let acme = create(conn, "Acme")?;
            assert!(create(conn, "acme").is_err());
            assert!(rename(conn, acme.id, "  ").is_err());
            let project = projects::create(
                conn,
                &projects::ProjectInput {
                    name: "Website".into(),
                    parent_id: None,
                    color: "blue".into(),
                },
            )?;
            conn.execute(
                "UPDATE project SET group_id = ?1 WHERE id = ?2",
                params![acme.id, project.id],
            )?;
            delete(conn, acme.id)?;
            assert_eq!(projects::get(conn, project.id)?.group_id, None);
            Ok(())
        })
        .unwrap();
    }
}
