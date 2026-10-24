use rusqlite::{Connection, params};

use super::queries::{get_status, get_type, milestone_project};
use super::reconcile::reconcile;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::tasks::{self, Task};
use crate::types::Id;
use crate::validate::{ensure_changed, optional_text};

/// Gives a task a type of its project. A type with a checklist adds its
/// items as sub-tasks when the task has none yet.
pub fn set_task_type(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    type_id: Option<&Id>,
) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    let item_type = match type_id {
        Some(type_id) => {
            let item_type = get_type(conn, type_id)?;
            if Some(&item_type.project_id) != task.project_id.as_ref() {
                return Err(Error::invalid("That type belongs to another project."));
            }
            if item_type.kind == "event" && task.due_time.is_none() {
                return Err(Error::invalid(
                    "Give it a date and time first. Events happen at a time.",
                ));
            }
            Some(item_type)
        }
        None => None,
    };
    conn.execute(
        "UPDATE task SET type_id = ?1,
                         estimate_minutes = COALESCE(estimate_minutes, ?2),
                         completed_at = CASE WHEN ?3 THEN NULL ELSE completed_at END
         WHERE id = ?4",
        params![
            type_id,
            item_type.as_ref().and_then(|t| t.default_minutes),
            item_type.as_ref().is_some_and(|t| t.kind == "event"),
            id
        ],
    )?;
    let has_children: bool = conn.query_row(
        "SELECT EXISTS (SELECT 1 FROM task WHERE parent_id = ?1)",
        params![id],
        |row| row.get(0),
    )?;
    if let Some(item_type) = &item_type
        && !has_children
    {
        for (position, line) in item_type
            .checklist
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .enumerate()
        {
            conn.execute(
                "INSERT INTO task (id, title, project_id, section_id, parent_id, position,
                                   created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    env.next_id(),
                    line,
                    task.project_id,
                    task.section_id,
                    id,
                    position as i64,
                    env.timestamp()
                ],
            )?;
        }
        reconcile(conn)?;
    }
    tasks::get(conn, id)
}

/// Sets a task's status; a closed category checks it (and its sub-tasks)
/// off, an open one reopens it.
pub fn set_task_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    status_id: &Id,
) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    let status = get_status(conn, status_id)?;
    if Some(&status.project_id) != task.project_id.as_ref() {
        return Err(Error::invalid("That status belongs to another project."));
    }
    if task.kind == "event" {
        return Err(Error::invalid(
            "Events happen at a time; they don't have a status.",
        ));
    }
    let closing = matches!(status.category.as_str(), "done" | "dropped");
    if closing && task.completed_at.is_none() && task.recurrence.is_some() {
        return tasks::set_completed(conn, env, id, true);
    }
    conn.execute(
        "UPDATE task SET status_id = ?1, status_changed_at = ?2 WHERE id = ?3",
        params![status_id, env.timestamp(), id],
    )?;
    if closing && task.completed_at.is_none() {
        conn.execute(
            "UPDATE task SET completed_at = ?1
             WHERE completed_at IS NULL AND id IN (
               WITH RECURSIVE down(id) AS (
                 SELECT ?2 UNION ALL SELECT t.id FROM task t JOIN down ON t.parent_id = down.id)
               SELECT id FROM down)",
            params![env.timestamp(), id],
        )?;
        tasks::stop_timer_within(conn, env, id)?;
    } else if !closing {
        conn.execute(
            "UPDATE task SET completed_at = NULL WHERE id = ?1",
            params![id],
        )?;
    }
    tasks::get(conn, id)
}

pub fn set_task_milestone(conn: &Connection, id: &Id, milestone_id: Option<&Id>) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    if let Some(milestone_id) = milestone_id
        && Some(milestone_project(conn, milestone_id)?) != task.project_id
    {
        return Err(Error::invalid("That milestone belongs to another project."));
    }
    conn.execute(
        "UPDATE task SET milestone_id = ?1 WHERE id = ?2",
        params![milestone_id, id],
    )?;
    tasks::get(conn, id)
}

pub fn set_task_event(
    conn: &Connection,
    id: &Id,
    location: &str,
    counts_as_time: bool,
) -> Result<Task> {
    let location = optional_text(location, "Location", 300)?;
    let rows = conn.execute(
        "UPDATE task SET location = ?1, counts_as_time = ?2 WHERE id = ?3",
        params![location, counts_as_time, id],
    )?;
    ensure_changed(rows, "Task")?;
    tasks::get(conn, id)
}
