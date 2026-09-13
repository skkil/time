use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use specta::Type;
use tauri::State;

use super::optional_text;
use super::tasks::{self, Task, TaskInput};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::Id;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecordPhase {
    pub status_id: Id,
    pub notes: String,
}

fn record(conn: &Connection, id: Id) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    if task.kind != "record" {
        return Err(Error::invalid("Only records have phases."));
    }
    Ok(task)
}

fn check_phase(conn: &Connection, record: &Task, status_id: Id) -> Result<()> {
    let project: Option<Id> = conn
        .query_row(
            "SELECT project_id FROM item_status WHERE id = ?1",
            params![status_id],
            |row| row.get(0),
        )
        .optional()?;
    match project {
        None => Err(Error::not_found("Phase")),
        Some(project) if Some(project) != record.project_id => {
            Err(Error::invalid("That phase belongs to another project."))
        }
        Some(_) => Ok(()),
    }
}

pub fn phases(conn: &Connection, task_id: Id) -> Result<Vec<RecordPhase>> {
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

pub fn set_notes(conn: &Connection, task_id: Id, status_id: Id, notes: &str) -> Result<()> {
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
            "INSERT INTO record_phase (task_id, status_id, notes) VALUES (?1, ?2, ?3)
             ON CONFLICT (task_id, status_id) DO UPDATE SET notes = excluded.notes",
            params![task_id, status_id, notes],
        )?;
    }
    Ok(())
}

pub fn set_phase(conn: &Connection, id: Id, phase_id: Option<Id>) -> Result<Task> {
    let task = tasks::get(conn, id)?;
    if let Some(phase_id) = phase_id {
        let parent = task
            .parent_id
            .ok_or_else(|| Error::invalid("Only tasks inside a record have a phase."))?;
        check_phase(conn, &record(conn, parent)?, phase_id)?;
    }
    conn.execute(
        "UPDATE task SET phase_id = ?1 WHERE id = ?2",
        params![phase_id, id],
    )?;
    tasks::get(conn, id)
}

pub fn create_task(
    conn: &mut Connection,
    record_id: Id,
    phase_id: Id,
    title: &str,
) -> Result<Task> {
    let parent = record(conn, record_id)?;
    check_phase(conn, &parent, phase_id)?;
    let task = tasks::create(
        conn,
        &TaskInput {
            title: title.into(),
            notes: String::new(),
            project_id: parent.project_id,
            section_id: parent.section_id,
            parent_id: Some(record_id),
            priority: 4,
            due_date: None,
            due_time: None,
            deadline: None,
            recurrence: None,
            estimate_minutes: None,
        },
    )?;
    set_phase(conn, task.id, Some(phase_id))
}

#[tauri::command]
#[specta::specta]
pub async fn list_record_phases(db: State<'_, Db>, task_id: Id) -> Result<Vec<RecordPhase>> {
    db.call(|conn| phases(conn, task_id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_record_phase_notes(
    db: State<'_, Db>,
    task_id: Id,
    status_id: Id,
    notes: String,
) -> Result<()> {
    db.call(|conn| set_notes(conn, task_id, status_id, &notes))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_phase(db: State<'_, Db>, id: Id, phase_id: Option<Id>) -> Result<Task> {
    db.call(|conn| set_phase(conn, id, phase_id))
}

#[tauri::command]
#[specta::specta]
pub async fn create_phase_task(
    db: State<'_, Db>,
    record_id: Id,
    phase_id: Id,
    title: String,
) -> Result<Task> {
    db.call(|conn| create_task(conn, record_id, phase_id, &title))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::projects::{self, ProjectInput};
    use crate::features::tasks::{TaskPlacement, input};
    use crate::features::workflow::{self, Workflow};

    fn job_search(conn: &mut Connection, name: &str) -> Result<Id> {
        let id = projects::create(
            conn,
            &ProjectInput {
                name: name.into(),
                parent_id: None,
                color: "blue".into(),
            },
        )?
        .id;
        let preset = workflow::presets()
            .into_iter()
            .find(|p| p.key == "job_search")
            .unwrap();
        workflow::apply_preset(conn, id, &preset)?;
        Ok(id)
    }

    fn status(workflow: &Workflow, project: Id, name: &str) -> Id {
        workflow
            .statuses
            .iter()
            .find(|s| s.project_id == project && s.name == name)
            .unwrap()
            .id
    }

    fn application(conn: &mut Connection, project: Id, title: &str) -> Result<Task> {
        let record_type = workflow::list(conn)?
            .types
            .into_iter()
            .find(|t| t.project_id == project && t.kind == "record")
            .unwrap();
        let task = tasks::create(conn, &input(title, Some(project)))?;
        workflow::set_task_type(conn, task.id, Some(record_type.id))
    }

    #[test]
    fn records_hold_tasks_and_notes_per_phase() {
        let db = Db::in_memory();
        db.call(|conn| {
            let project = job_search(conn, "Jobs")?;
            let flow = workflow::list(conn)?;
            let applied = status(&flow, project, "Applied");
            let interviewing = status(&flow, project, "Interviewing");
            let acme = application(conn, project, "Acme")?;
            assert_eq!(acme.kind, "record");

            let cover = create_task(conn, acme.id, applied, "Write cover letter")?;
            assert_eq!(cover.parent_id, Some(acme.id));
            assert_eq!(cover.phase_id, Some(applied));
            let prep = create_task(conn, acme.id, interviewing, "Practise system design")?;
            assert_eq!(set_phase(conn, prep.id, None)?.phase_id, None);

            set_notes(conn, acme.id, interviewing, "Panel of three")?;
            set_notes(conn, acme.id, applied, "Sent via referral")?;
            set_notes(conn, acme.id, applied, "  ")?;
            let notes = phases(conn, acme.id)?;
            assert_eq!(notes.len(), 1);
            assert_eq!(notes[0].notes, "Panel of three");

            let plain = tasks::create(conn, &input("Update CV", Some(project)))?;
            assert!(set_notes(conn, plain.id, applied, "x").is_err());
            assert!(set_phase(conn, plain.id, Some(applied)).is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn moving_a_record_keeps_phases_by_name() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = job_search(conn, "Jobs 2026")?;
            let b = job_search(conn, "Jobs 2027")?;
            let flow = workflow::list(conn)?;
            let acme = application(conn, a, "Acme")?;
            let task = create_task(conn, acme.id, status(&flow, a, "Offer"), "Negotiate")?;
            set_notes(conn, acme.id, status(&flow, a, "Offer"), "Ask for remote")?;

            tasks::move_to(
                conn,
                acme.id,
                TaskPlacement {
                    project_id: Some(b),
                    section_id: None,
                    parent_id: None,
                    before: None,
                },
            )?;
            let offer = status(&flow, b, "Offer");
            assert_eq!(tasks::get(conn, task.id)?.phase_id, Some(offer));
            assert_eq!(phases(conn, acme.id)?[0].status_id, offer);
            Ok(())
        })
        .unwrap();
    }
}
