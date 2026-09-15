use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use specta::Type;
use tauri::State;

use super::projects;
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Id, Timestamp};

const MAX_CONTENT: usize = 2_000_000;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCanvas {
    pub project_id: Id,
    pub content: String,
    pub updated_at: Option<Timestamp>,
}

pub fn get(conn: &Connection, project_id: Id) -> Result<ProjectCanvas> {
    projects::get(conn, project_id)?;
    let saved = conn
        .query_row(
            "SELECT content, updated_at FROM project_canvas WHERE project_id = ?1",
            params![project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let (content, updated_at) = saved.map_or((String::new(), None), |(content, updated_at)| {
        (content, Some(updated_at))
    });
    Ok(ProjectCanvas {
        project_id,
        content,
        updated_at,
    })
}

pub fn save(conn: &Connection, project_id: Id, content: &str) -> Result<ProjectCanvas> {
    projects::get(conn, project_id)?;
    if content.len() > MAX_CONTENT {
        return Err(Error::invalid("The canvas is too large to save."));
    }
    conn.execute(
        "INSERT INTO project_canvas (project_id, content, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (project_id) DO UPDATE SET content = ?2, updated_at = ?3",
        params![project_id, content, Timestamp::now()],
    )?;
    get(conn, project_id)
}

#[tauri::command]
#[specta::specta]
pub async fn get_project_canvas(db: State<'_, Db>, project_id: Id) -> Result<ProjectCanvas> {
    db.call(|conn| get(conn, project_id))
}

#[tauri::command]
#[specta::specta]
pub async fn save_project_canvas(
    db: State<'_, Db>,
    project_id: Id,
    content: String,
) -> Result<ProjectCanvas> {
    db.call(|conn| save(conn, project_id, &content))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_overwrites_and_goes_with_the_project() {
        let db = Db::in_memory();
        db.call(|conn| {
            let project = projects::create(
                conn,
                &projects::ProjectInput {
                    name: "Website".into(),
                    parent_id: None,
                    color: "blue".into(),
                },
            )?;
            assert_eq!(get(conn, project.id)?.updated_at, None);
            save(conn, project.id, "<p>First</p>")?;
            let canvas = save(conn, project.id, "<p>Second</p>")?;
            assert_eq!(canvas.content, "<p>Second</p>");
            assert!(canvas.updated_at.is_some());
            assert!(save(conn, Id(999), "<p>x</p>").is_err());

            projects::delete(conn, project.id)?;
            let left: i64 =
                conn.query_row("SELECT COUNT(*) FROM project_canvas", [], |row| row.get(0))?;
            assert_eq!(left, 0);
            Ok(())
        })
        .unwrap();
    }
}
