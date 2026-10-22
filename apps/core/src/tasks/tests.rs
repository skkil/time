use chrono::Datelike;

use super::*;
use crate::error::Error;
use crate::testing::{db, env, project, task_input as input};
use crate::types::{Date, date};
use crate::{projects, sections};

fn placement(
    project_id: Option<&crate::types::Id>,
    before: Option<&crate::types::Id>,
) -> TaskPlacement {
    TaskPlacement {
        project_id: project_id.cloned(),
        section_id: None,
        parent_id: None,
        before: before.cloned(),
    }
}

#[test]
fn hides_tasks_of_archived_projects() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let side = project(conn, "Side")?;
        create(conn, &env, &input("Inbox task", None))?;
        create(conn, &env, &input("Project task", Some(&side)))?;
        projects::set_archived(conn, &side, true)?;

        let titles: Vec<_> = list(conn)?.into_iter().map(|t| t.title).collect();
        assert_eq!(titles, vec!["Inbox task"]);
        Ok(())
    })
    .unwrap();
}

#[test]
fn validates_fields() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        assert!(create(conn, &env, &input("  ", None)).is_err());
        let mut long = input("Write", None);
        long.estimate_minutes = Some(MAX_ESTIMATE_MINUTES + 1);
        assert!(create(conn, &env, &long).is_err());
        let mut timed = input("Call", None);
        timed.due_time = Some(600);
        assert!(create(conn, &env, &timed).is_err());
        let mut repeating = input("Run", None);
        repeating.recurrence = Some("every day".into());
        assert_eq!(
            create(conn, &env, &repeating)?.due_date,
            Some(Date::today())
        );
        repeating.due_date = Some(date("2026-11-02"));
        repeating.recurrence = Some("Daily".into());
        assert_eq!(
            create(conn, &env, &repeating)?.recurrence.as_deref(),
            Some("every day")
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_new_repeat_starts_on_its_first_occurrence() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let mut task = input("Standup", None);
        task.recurrence = Some("every mon".into());
        task.due_time = Some(600);
        let created = create(conn, &env, &task)?;
        let due = created.due_date.unwrap();
        assert_eq!(due.0.weekday(), chrono::Weekday::Mon);
        assert_eq!(created.due_time, Some(600));
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_repeat_closes_after_its_end_date() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let today = Date::today();
        let mut task = input("Stretch", None);
        task.due_date = Some(today);
        task.recurrence = Some(format!("every day ending {today}"));
        let task = create(conn, &env, &task)?;
        assert!(
            set_completed(conn, &env, &task.id, true)?
                .completed_at
                .is_some()
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn deep_subtasks_follow_every_ancestor() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let school = project(conn, "School")?;
        let work = project(conn, "Work")?;
        let root = create(conn, &env, &input("Root", Some(&school)))?;
        let mut chain = vec![root.id.clone()];
        for depth in 1..=8 {
            let mut step = input(&format!("Level {depth}"), None);
            step.parent_id = chain.last().cloned();
            chain.push(create(conn, &env, &step)?.id);
        }
        let deepest = chain.last().unwrap().clone();
        assert_eq!(get(conn, &deepest)?.project_id, Some(school.clone()));

        let mut cycle = input("Root", Some(&school));
        cycle.parent_id = Some(deepest.clone());
        assert!(update(conn, &root.id, &cycle).is_err());

        move_to(conn, &root.id, &placement(Some(&work), None))?;
        assert_eq!(get(conn, &deepest)?.project_id, Some(work));

        set_completed(conn, &env, &root.id, true)?;
        assert!(get(conn, &deepest)?.completed_at.is_some());

        delete(conn, &root.id)?;
        assert!(get(conn, &deepest).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn subtasks_follow_parent_and_complete_with_it() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let school = project(conn, "School")?;
        let week = sections::create(conn, &env, Some(&school), "Week 9", None)?;
        let mut parent = input("Homework 3", Some(&school));
        parent.section_id = Some(week.id.clone());
        let parent = create(conn, &env, &parent)?;
        let mut child = input("Problem 1", None);
        child.parent_id = Some(parent.id.clone());
        let child = create(conn, &env, &child)?;
        assert_eq!(child.project_id, Some(school.clone()));
        assert_eq!(child.section_id, Some(week.id));

        let mut cycle = input("Homework 3", Some(&school));
        cycle.parent_id = Some(child.id.clone());
        assert!(update(conn, &parent.id, &cycle).is_err());

        move_to(conn, &parent.id, &placement(None, None))?;
        assert_eq!(get(conn, &child.id)?.project_id, None);

        set_completed(conn, &env, &parent.id, true)?;
        assert!(get(conn, &child.id)?.completed_at.is_some());
        Ok(())
    })
    .unwrap();
}

#[test]
fn rejects_sections_from_other_projects() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = project(conn, "A")?;
        let b = project(conn, "B")?;
        let section = sections::create(conn, &env, Some(&a), "Doing", None)?;
        let mut task = input("Mixed", Some(&b));
        task.section_id = Some(section.id);
        assert!(matches!(create(conn, &env, &task), Err(Error::Invalid(_))));
        Ok(())
    })
    .unwrap();
}

#[test]
fn orders_siblings() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, &input("A", None))?;
        let b = create(conn, &env, &input("B", None))?;
        let c = create(conn, &env, &input("C", None))?;
        move_to(conn, &c.id, &placement(None, Some(&a.id)))?;
        let titles: Vec<_> = list(conn)?.into_iter().map(|t| t.title).collect();
        assert_eq!(titles, ["C", "A", "B"]);
        assert_eq!(get(conn, &b.id)?.position, 3);
        Ok(())
    })
    .unwrap();
}

#[test]
fn rescheduling_a_due_task_counts_a_rollover() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let today = Date::today();
        let mut task = input("Essay", None);
        task.due_date = Some(today.add_days(-1));
        let task = create(conn, &env, &task)?;
        let ids = [task.id.clone()];
        reschedule(conn, &env, &ids, Some(today))?;
        reschedule(conn, &env, &ids, Some(today.add_days(1)))?;
        assert_eq!(get(conn, &task.id)?.rollover_count, 2);
        reschedule(conn, &env, &ids, Some(today.add_days(5)))?;
        assert_eq!(get(conn, &task.id)?.rollover_count, 2);

        set_someday(conn, &ids, true)?;
        let parked = get(conn, &task.id)?;
        assert!(parked.someday);
        assert_eq!(parked.due_date, None);

        let must = set_must(conn, &task.id, Some(today))?;
        assert!(!must.someday);
        assert_eq!(must.must_on, Some(today));
        Ok(())
    })
    .unwrap();
}

#[test]
fn completing_a_repeating_task_moves_it_forward() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let mut task = input("Lecture", None);
        task.due_date = Some(Date::today());
        task.recurrence = Some("every week".into());
        let task = create(conn, &env, &task)?;
        let next = set_completed(conn, &env, &task.id, true)?;
        assert!(next.completed_at.is_none());
        assert_eq!(next.due_date, Some(Date::today().add_days(7)));
        Ok(())
    })
    .unwrap();
}
