use rusqlite::{Connection, params};

use super::queries::{descendants, get};
use crate::error::{Error, Result};
use crate::types::Id;
use crate::{projects, sections};

/// Where a task sits: sub-tasks take their parent's project and section.
#[derive(Debug, Clone, PartialEq)]
pub struct Container {
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
}

pub fn resolve_container(
    conn: &Connection,
    moving: Option<&Id>,
    project_id: Option<&Id>,
    section_id: Option<&Id>,
    parent_id: Option<&Id>,
) -> Result<Container> {
    if let Some(parent_id) = parent_id {
        let parent = get(conn, parent_id)?;
        if let Some(id) = moving
            && (parent_id == id || descendants(conn, id)?.contains(parent_id))
        {
            return Err(Error::invalid("A task can't become its own sub-task."));
        }
        return Ok(Container {
            project_id: parent.project_id,
            section_id: parent.section_id,
            parent_id: Some(parent_id.clone()),
        });
    }
    if let Some(project_id) = project_id
        && projects::get(conn, project_id)?.archived
    {
        return Err(Error::invalid("Can't add tasks to an archived project."));
    }
    if let Some(section_id) = section_id
        && sections::get(conn, section_id)?.project_id.as_ref() != project_id
    {
        return Err(Error::invalid("That section belongs to another project."));
    }
    Ok(Container {
        project_id: project_id.cloned(),
        section_id: section_id.cloned(),
        parent_id: None,
    })
}

fn open_siblings(conn: &Connection, container: &Container, except: &Id) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM task
         WHERE project_id IS ?1 AND section_id IS ?2 AND parent_id IS ?3 AND id != ?4
           AND completed_at IS NULL
         ORDER BY position, id",
    )?;
    let rows = stmt.query_map(
        params![
            container.project_id,
            container.section_id,
            container.parent_id,
            except
        ],
        |row| row.get(0),
    )?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Puts the task into `container` before `before` (or last), renumbers its
/// open siblings and carries every sub-task along.
pub fn place(conn: &Connection, id: &Id, container: &Container, before: Option<&Id>) -> Result<()> {
    let mut ids = open_siblings(conn, container, id)?;
    let index = before
        .and_then(|before| ids.iter().position(|other| other == before))
        .unwrap_or(ids.len());
    ids.insert(index, id.clone());
    for (position, sibling) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE task SET position = ?1 WHERE id = ?2",
            params![position as i64 + 1, sibling],
        )?;
    }
    conn.execute(
        "UPDATE task SET project_id = ?1, section_id = ?2, parent_id = ?3 WHERE id = ?4",
        params![
            container.project_id,
            container.section_id,
            container.parent_id,
            id
        ],
    )?;
    for child in descendants(conn, id)? {
        conn.execute(
            "UPDATE task SET project_id = ?1, section_id = ?2 WHERE id = ?3",
            params![container.project_id, container.section_id, child],
        )?;
    }
    Ok(())
}
