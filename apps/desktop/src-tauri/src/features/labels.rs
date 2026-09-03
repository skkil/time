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
pub struct Label {
    pub id: Id,
    pub name: String,
    pub color: String,
}

const SELECT: &str = "SELECT id, name, color FROM label";

fn from_row(row: &Row) -> rusqlite::Result<Label> {
    Ok(Label {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
    })
}

pub fn get(conn: &Connection, id: Id) -> Result<Label> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Label"))
}

pub fn list(conn: &Connection) -> Result<Vec<Label>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY name COLLATE NOCASE"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn validate(name: &str, color: &str) -> Result<String> {
    let name = required_text(name, "Label name", 60)?;
    if name.contains(char::is_whitespace) {
        return Err(Error::invalid("Label names can't contain spaces."));
    }
    if !projects::COLORS.contains(&color) {
        return Err(Error::invalid(format!("Unknown color: {color}")));
    }
    Ok(name)
}

fn duplicate(error: rusqlite::Error) -> Error {
    match error {
        rusqlite::Error::SqliteFailure(failure, _)
            if failure.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            Error::invalid("A label with that name already exists.")
        }
        other => other.into(),
    }
}

pub fn create(conn: &Connection, name: &str, color: &str) -> Result<Label> {
    let name = validate(name, color)?;
    conn.execute(
        "INSERT INTO label (name, color) VALUES (?1, ?2)",
        params![name, color],
    )
    .map_err(duplicate)?;
    get(conn, Id(conn.last_insert_rowid()))
}

pub fn update(conn: &Connection, id: Id, name: &str, color: &str) -> Result<Label> {
    let name = validate(name, color)?;
    let rows = conn
        .execute(
            "UPDATE label SET name = ?1, color = ?2 WHERE id = ?3",
            params![name, color, id],
        )
        .map_err(duplicate)?;
    ensure_changed(rows, "Label")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM label WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Label")
}

#[tauri::command]
#[specta::specta]
pub async fn list_labels(db: State<'_, Db>) -> Result<Vec<Label>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_label(db: State<'_, Db>, name: String, color: String) -> Result<Label> {
    db.call(|conn| create(conn, &name, &color))
}

#[tauri::command]
#[specta::specta]
pub async fn update_label(db: State<'_, Db>, id: Id, name: String, color: String) -> Result<Label> {
    db.call(|conn| update(conn, id, &name, &color))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_label(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_duplicates_and_spaces() {
        let db = Db::in_memory();
        db.call(|conn| {
            create(conn, "short", "graphite")?;
            assert!(matches!(
                create(conn, "Short", "blue"),
                Err(Error::Invalid(_))
            ));
            assert!(create(conn, "two words", "blue").is_err());
            assert_eq!(list(conn)?.len(), 1);
            Ok(())
        })
        .unwrap();
    }
}
