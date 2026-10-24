use rusqlite::params;

use super::*;
use crate::tasks::{self, TaskPlacement};
use crate::testing::{db, env, project, task_input as input};
use crate::types::{Id, date};

fn preset(key: &str) -> Preset {
    presets().into_iter().find(|p| p.key == key).unwrap()
}

fn into(project_id: Option<&Id>) -> TaskPlacement {
    TaskPlacement {
        project_id: project_id.cloned(),
        section_id: None,
        parent_id: None,
        before: None,
    }
}

#[test]
fn simple_projects_get_no_structure() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let id = project(conn, "Plain")?;
        apply_preset(conn, &env, &id, &preset("simple"))?;
        let task = tasks::create(conn, &env, &input("Write", Some(&id)))?;
        assert_eq!(task.status_id, None);
        assert_eq!(task.kind, "task");
        let workflow = list(conn)?;
        assert!(workflow.types.is_empty() && workflow.statuses.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn presets_give_new_and_existing_tasks_a_status() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let id = project(conn, "App")?;
        let old = tasks::create(conn, &env, &input("Old", Some(&id)))?;
        let done = tasks::create(conn, &env, &input("Shipped", Some(&id)))?;
        tasks::set_completed(conn, &env, &done.id, true)?;
        apply_preset(conn, &env, &id, &preset("software"))?;

        assert_eq!(
            tasks::get(conn, &old.id)?.status_category.as_deref(),
            Some("todo")
        );
        assert_eq!(
            tasks::get(conn, &done.id)?.status_category.as_deref(),
            Some("done")
        );
        let new = tasks::create(conn, &env, &input("New", Some(&id)))?;
        assert_eq!(new.status_category.as_deref(), Some("todo"));
        assert_eq!(list(conn)?.views.len(), 4);
        Ok(())
    })
    .unwrap();
}

#[test]
fn statuses_and_completion_stay_in_step() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let id = project(conn, "App")?;
        apply_preset(conn, &env, &id, &preset("software"))?;
        let statuses = list(conn)?.statuses;
        let by = |name: &str| statuses.iter().find(|s| s.name == name).unwrap().id.clone();
        let task = tasks::create(conn, &env, &input("Login", Some(&id)))?;

        let task = set_task_status(conn, &env, &task.id, &by("In review"))?;
        assert!(task.completed_at.is_none());
        assert!(task.status_changed_at.is_some());
        let task = set_task_status(conn, &env, &task.id, &by("Canceled"))?;
        assert!(task.completed_at.is_some());

        let task = tasks::set_completed(conn, &env, &task.id, false)?;
        assert_eq!(task.status_category.as_deref(), Some("todo"));
        let task = tasks::set_completed(conn, &env, &task.id, true)?;
        assert_eq!(task.status_id, Some(by("Done")));

        assert!(delete_status(conn, &env, &by("Done"), None).is_err());
        delete_status(conn, &env, &by("Done"), Some(&by("Canceled")))?;
        assert_eq!(tasks::get(conn, &task.id)?.status_id, Some(by("Canceled")));
        Ok(())
    })
    .unwrap();
}

#[test]
fn moving_to_another_project_maps_type_and_status() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = project(conn, "A")?;
        let b = project(conn, "B")?;
        apply_preset(conn, &env, &a, &preset("software"))?;
        apply_preset(conn, &env, &b, &preset("software"))?;
        let workflow = list(conn)?;
        let bug = |p: &Id| {
            workflow
                .types
                .iter()
                .find(|t| &t.project_id == p && t.name == "Bug")
                .unwrap()
                .id
                .clone()
        };
        let task = tasks::create(conn, &env, &input("Crash", Some(&a)))?;
        set_task_type(conn, &env, &task.id, Some(&bug(&a)))?;
        let moved = tasks::move_to(conn, &task.id, &into(Some(&b)))?;
        assert_eq!(moved.type_id, Some(bug(&b)));
        assert_eq!(moved.status_category.as_deref(), Some("todo"));

        let inbox = tasks::move_to(conn, &task.id, &into(None))?;
        assert_eq!((inbox.type_id, inbox.status_id), (None, None));
        Ok(())
    })
    .unwrap();
}

#[test]
fn types_add_their_checklist_and_events_need_a_time() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let id = project(conn, "Course")?;
        let mut course = preset("course");
        course.types[1].checklist = "Skim\nTake notes\n".into();
        apply_preset(conn, &env, &id, &course)?;
        let types = list(conn)?.types;
        let reading = types
            .iter()
            .find(|t| t.name == "Reading")
            .unwrap()
            .id
            .clone();
        let lecture = types
            .iter()
            .find(|t| t.name == "Lecture")
            .unwrap()
            .id
            .clone();

        let task = tasks::create(conn, &env, &input("Chapter 3", Some(&id)))?;
        set_task_type(conn, &env, &task.id, Some(&reading))?;
        let children: i64 = conn.query_row(
            "SELECT COUNT(*) FROM task WHERE parent_id = ?1",
            params![task.id],
            |row| row.get(0),
        )?;
        assert_eq!(children, 2);

        let talk = tasks::create(conn, &env, &input("Lecture 1", Some(&id)))?;
        assert!(set_task_type(conn, &env, &talk.id, Some(&lecture)).is_err());
        let mut timed = input("Lecture 1", Some(&id));
        timed.due_date = Some(date("2026-11-02"));
        timed.due_time = Some(10 * 60);
        timed.recurrence = Some("every monday".into());
        let talk = tasks::update(conn, &talk.id, &timed)?;
        let talk = set_task_type(conn, &env, &talk.id, Some(&lecture))?;
        assert_eq!(talk.kind, "event");
        assert_eq!(talk.estimate_minutes, Some(90));
        assert!(tasks::set_completed(conn, &env, &talk.id, true).is_err());

        let events = occurrences(conn, date("2026-11-02"), date("2026-11-23"))?;
        assert_eq!(events.len(), 3);
        assert_eq!(
            events[1].start_at.0,
            date("2026-11-09").start().0 + 10 * 3600
        );
        assert_eq!(events[0].end_at.0 - events[0].start_at.0, 90 * 60);
        Ok(())
    })
    .unwrap();
}

#[test]
fn presets_round_trip_through_a_file() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let id = project(conn, "Job hunt")?;
        apply_preset(conn, &env, &id, &preset("pipeline"))?;
        let exported = export_preset(conn, &id)?;
        let text = serde_json::to_string(&exported).unwrap();
        let parsed = parse_preset(&text)?;
        assert_eq!(parsed.statuses.len(), 5);
        assert!(parse_preset("{}").is_err());
        Ok(())
    })
    .unwrap();
}
