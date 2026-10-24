use rusqlite::{Connection, params};

use super::model::RecordPhase;
use super::rules::{check_phase, record};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::tasks::{self, Task, TaskInput};
use crate::types::Id;
use crate::validate::optional_text;

pub fn phases(conn: &Connection, task_id: &Id) -> Result<Vec<RecordPhase>> {
    Ok(conn
        .prepare("SELECT status_id, notes FROM record_phase WHERE task_id = ?1")?
        .query_map(params![task_id], |row| {
            Ok(RecordPhase {
                status_id: row.get(0)?,
                notes: row.get(1)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?)
}

/// Saves a record's note for one phase; blank notes are removed.
pub fn set_notes(
    conn: &Connection,
    env: &dyn MutationEnv,
    task_id: &Id,
    status_id: &Id,
    notes: &str,
) -> Result<()> {
    let record = record(conn, task_id)?;
    check_phase(conn, &record, status_id)?;
    let notes = optional_text(notes, "Phase notes", 20_000)?;
    if notes.is_empty() {
        conn.execute(
            "DELETE FROM record_phase WHERE task_id = ?1 AND status_id = ?2",
            params![task_id, status_id],
        )?;
    } else {
        conn.execute(
            "INSERT INTO record_phase (id, task_id, status_id, notes) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (task_id, status_id) DO UPDATE SET notes = excluded.notes",
            params![env.next_id(), task_id, status_id, notes],
        )?;
    }
    Ok(())
}

pub fn set_phase(conn: &Connection, id: &Id, phase_id: Option<&Id>) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    if let Some(phase_id) = phase_id {
        let parent = task
            .parent_id
            .ok_or_else(|| Error::invalid("Only tasks inside a record have a phase."))?;
        check_phase(conn, &record(conn, &parent)?, phase_id)?;
    }
    conn.execute(
        "UPDATE task SET phase_id = ?1 WHERE id = ?2",
        params![phase_id, id],
    )?;
    tasks::get(conn, id)
}

pub fn create_task(
    conn: &Connection,
    env: &dyn MutationEnv,
    record_id: &Id,
    phase_id: &Id,
    title: &str,
) -> Result<Task> {
    let parent = record(conn, record_id)?;
    check_phase(conn, &parent, phase_id)?;
    let task = tasks::create(
        conn,
        env,
        &TaskInput {
            title: title.into(),
            notes: String::new(),
            project_id: parent.project_id,
            section_id: parent.section_id,
            parent_id: Some(record_id.clone()),
            priority: 4,
            due_date: None,
            due_time: None,
            deadline: None,
            recurrence: None,
            estimate_minutes: None,
        },
    )?;
    set_phase(conn, &task.id, Some(phase_id))
}
