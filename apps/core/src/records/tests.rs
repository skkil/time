use rusqlite::Connection;

use super::*;
use crate::error::Result;
use crate::tasks::{self, Task, TaskPlacement};
use crate::testing::{env, project, task_input as input};
use crate::types::Id;
use crate::workflow::{self, Workflow};

fn job_search(conn: &Connection, name: &str) -> Result<Id> {
    let id = project(conn, name)?;
    let preset = workflow::presets()
        .into_iter()
        .find(|p| p.key == "job_search")
        .unwrap();
    workflow::apply_preset(conn, &env(), &id, &preset)?;
    Ok(id)
}

fn status(workflow: &Workflow, project: &Id, name: &str) -> Id {
    workflow
        .statuses
        .iter()
        .find(|s| &s.project_id == project && s.name == name)
        .unwrap()
        .id
        .clone()
}

fn application(conn: &Connection, project: &Id, title: &str) -> Result<Task> {
    let record_type = workflow::list(conn)?
        .types
        .into_iter()
        .find(|t| &t.project_id == project && t.kind == "record")
        .unwrap();
    let task = tasks::create(conn, &env(), &input(title, Some(project)))?;
    workflow::set_task_type(conn, &env(), &task.id, Some(&record_type.id))
}

#[test]
fn records_hold_tasks_and_notes_per_phase() {
    let (db, env) = (crate::testing::db(), env());
    db.call(|conn| {
        let project = job_search(conn, "Jobs")?;
        let flow = workflow::list(conn)?;
        let applied = status(&flow, &project, "Applied");
        let interviewing = status(&flow, &project, "Interviewing");
        let acme = application(conn, &project, "Acme")?;
        assert_eq!(acme.kind, "record");

        let cover = create_task(conn, &env, &acme.id, &applied, "Write cover letter")?;
        assert_eq!(cover.parent_id, Some(acme.id.clone()));
        assert_eq!(cover.phase_id, Some(applied.clone()));
        let prep = create_task(
            conn,
            &env,
            &acme.id,
            &interviewing,
            "Practise system design",
        )?;
        assert_eq!(set_phase(conn, &prep.id, None)?.phase_id, None);

        set_notes(conn, &env, &acme.id, &interviewing, "Panel of three")?;
        set_notes(conn, &env, &acme.id, &applied, "Sent via referral")?;
        set_notes(conn, &env, &acme.id, &applied, "  ")?;
        let notes = phases(conn, &acme.id)?;
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].notes, "Panel of three");

        let plain = tasks::create(conn, &env, &input("Update CV", Some(&project)))?;
        assert!(set_notes(conn, &env, &plain.id, &applied, "x").is_err());
        assert!(set_phase(conn, &plain.id, Some(&applied)).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn moving_a_record_keeps_phases_by_name() {
    let (db, env) = (crate::testing::db(), env());
    db.call(|conn| {
        let a = job_search(conn, "Jobs 2026")?;
        let b = job_search(conn, "Jobs 2027")?;
        let flow = workflow::list(conn)?;
        let acme = application(conn, &a, "Acme")?;
        let offer_a = status(&flow, &a, "Offer");
        let task = create_task(conn, &env, &acme.id, &offer_a, "Negotiate")?;
        set_notes(conn, &env, &acme.id, &offer_a, "Ask for remote")?;

        tasks::move_to(
            conn,
            &acme.id,
            &TaskPlacement {
                project_id: Some(b.clone()),
                section_id: None,
                parent_id: None,
                before: None,
            },
        )?;
        let offer = status(&flow, &b, "Offer");
        assert_eq!(tasks::get(conn, &task.id)?.phase_id, Some(offer.clone()));
        assert_eq!(phases(conn, &acme.id)?[0].status_id, offer);
        Ok(())
    })
    .unwrap();
}
