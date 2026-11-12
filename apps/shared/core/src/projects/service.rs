use rusqlite::{Connection, params};

use super::model::{Project, ProjectInput, ProjectSettings, VIEWS};
use super::queries::{get, siblings, subtree};
use super::rules::{validate, validate_settings};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::Id;
use crate::validate::ensure_changed;

pub fn create(conn: &Connection, env: &dyn MutationEnv, input: &ProjectInput) -> Result<Project> {
    let name = validate(conn, input, None)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO project (id, parent_id, name, color, position, review_every_weeks)
         VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(position), 0) + 1 FROM project), 1)",
        params![id, input.parent_id, name, input.color],
    )?;
    get(conn, &id)
}

pub fn update(conn: &Connection, id: &Id, input: &ProjectInput) -> Result<Project> {
    let current = get(conn, id)?;
    let moving = (current.parent_id != input.parent_id).then_some(id);
    let name = validate(conn, input, moving)?;
    conn.execute(
        "UPDATE project SET parent_id = ?1, name = ?2, color = ?3,
                            group_id = CASE WHEN ?1 IS NULL THEN group_id END
         WHERE id = ?4",
        params![input.parent_id, name, input.color, id],
    )?;
    get(conn, id)
}

/// Moves a project before `before` among its siblings (to the end when
/// `before` is `None` or not a sibling) and renumbers them densely.
pub fn reorder(conn: &Connection, id: &Id, before: Option<&Id>) -> Result<Project> {
    let project = get(conn, id)?;
    let mut ids = siblings(conn, project.parent_id.as_ref(), id)?;
    let index = before
        .and_then(|before| ids.iter().position(|other| other == before))
        .unwrap_or(ids.len());
    ids.insert(index, id.clone());
    for (position, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE project SET position = ?1 WHERE id = ?2",
            params![position as i64 + 1, id],
        )?;
    }
    get(conn, id)
}

pub fn set_archived(conn: &Connection, id: &Id, archived: bool) -> Result<()> {
    let ids = subtree(conn, id)?;
    if ids.is_empty() {
        return Err(Error::not_found("Project"));
    }
    if !archived
        && let Some(parent_id) = get(conn, id)?.parent_id
        && get(conn, &parent_id)?.archived
    {
        return Err(Error::invalid("Restore the parent project first."));
    }
    for (project_id, _) in ids {
        conn.execute(
            "UPDATE project SET archived = ?1 WHERE id = ?2",
            params![archived, project_id],
        )?;
    }
    Ok(())
}

pub fn set_view(conn: &Connection, id: &Id, view: &str) -> Result<Project> {
    if !VIEWS.contains(&view) {
        return Err(Error::invalid(format!("Unknown view: {view}")));
    }
    let rows = conn.execute(
        "UPDATE project SET view = ?1 WHERE id = ?2",
        params![view, id],
    )?;
    ensure_changed(rows, "Project")?;
    get(conn, id)
}

pub fn update_settings(conn: &Connection, id: &Id, settings: &ProjectSettings) -> Result<Project> {
    let current = get(conn, id)?;
    let valid = validate_settings(conn, current.parent_id.as_ref(), settings)?;
    conn.execute(
        "UPDATE project SET group_id = ?1, status = ?2, outcome = ?3, weekly_minutes = ?4,
                            target_date = ?5, kill_criteria = ?6, review_every_weeks = ?7,
                            in_order = ?8
         WHERE id = ?9",
        params![
            settings.group_id,
            settings.status,
            valid.outcome,
            settings.weekly_minutes,
            settings.target_date,
            valid.kill_criteria,
            settings.review_every_weeks,
            settings.in_order,
            id
        ],
    )?;
    get(conn, id)
}

pub fn mark_reviewed(conn: &Connection, env: &dyn MutationEnv, id: &Id) -> Result<Project> {
    let rows = conn.execute(
        "UPDATE project SET last_reviewed_at = ?1 WHERE id = ?2",
        params![env.timestamp(), id],
    )?;
    ensure_changed(rows, "Project")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM project WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Project")
}
