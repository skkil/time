use rusqlite::{Connection, OptionalExtension, params};

use super::model::{MAX_CONTENT, ProjectCanvas};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::projects;
use crate::types::Id;

pub fn get(conn: &Connection, project_id: &Id) -> Result<ProjectCanvas> {
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
        project_id: project_id.clone(),
        content,
        updated_at,
    })
}

pub fn save(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    content: &str,
) -> Result<ProjectCanvas> {
    projects::get(conn, project_id)?;
    if content.len() > MAX_CONTENT {
        return Err(Error::invalid("The canvas is too large to save."));
    }
    conn.execute(
        "INSERT INTO project_canvas (id, project_id, content, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (project_id) DO UPDATE SET content = ?3, updated_at = ?4",
        params![env.next_id(), project_id, content, env.timestamp()],
    )?;
    get(conn, project_id)
}
