use rusqlite::{Connection, params};

use super::model::MilestoneInput;
use super::queries::next_position;
use super::rules::{check_milestone, check_milestone_label};
use crate::env::MutationEnv;
use crate::error::Result;
use crate::projects;
use crate::types::Id;
use crate::validate::ensure_changed;

pub fn create_milestone(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    input: &MilestoneInput,
) -> Result<Id> {
    projects::get(conn, project_id)?;
    let name = check_milestone(input)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO milestone (id, project_id, name, date, position) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            id,
            project_id,
            name,
            input.date,
            next_position(conn, "milestone", project_id)?
        ],
    )?;
    Ok(id)
}

pub fn update_milestone(conn: &Connection, id: &Id, input: &MilestoneInput) -> Result<()> {
    let name = check_milestone(input)?;
    let rows = conn.execute(
        "UPDATE milestone SET name = ?1, date = ?2 WHERE id = ?3",
        params![name, input.date, id],
    )?;
    ensure_changed(rows, "Milestone")
}

pub fn delete_milestone(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM milestone WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Milestone")
}

pub fn set_milestone_label(conn: &Connection, project_id: &Id, label: &str) -> Result<()> {
    let label = check_milestone_label(label)?;
    let rows = conn.execute(
        "UPDATE project SET milestone_label = ?1 WHERE id = ?2",
        params![label, project_id],
    )?;
    ensure_changed(rows, "Project")
}
