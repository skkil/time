use rusqlite::{Connection, params};

use super::*;
use crate::db::Db;
use crate::env::LocalEnv;
use crate::error::Result;
use crate::testing::{db, env, project_input, task_input};
use crate::types::{Date, Id, Timestamp};
use crate::{projects, tasks};

fn details(description: &str, task_id: Option<&Id>) -> EntryDetails {
    EntryDetails {
        description: description.into(),
        project_id: None,
        task_id: task_id.cloned(),
    }
}

#[test]
fn linked_task_decides_the_project() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let project = projects::create(conn, &env, &project_input("Thesis", None))?;
        let task = tasks::create(conn, &env, &task_input("Chapter 2", Some(&project.id)))?;
        let now = Timestamp::now();
        let entry = create(
            conn,
            &env,
            &EntryInput {
                details: details("writing", Some(&task.id)),
                started_at: Timestamp(now.0 - 1800),
                ended_at: now,
            },
        )?;
        assert_eq!(entry.project_id, Some(project.id));
        assert_eq!(tasks::get(conn, &task.id)?.tracked_seconds.0, 1800);
        Ok(())
    })
    .unwrap();
}

#[test]
fn rejects_backwards_and_future_entries() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let now = Timestamp::now();
        let backwards = EntryInput {
            details: details("", None),
            started_at: now,
            ended_at: Timestamp(now.0 - 10),
        };
        let future = EntryInput {
            details: details("", None),
            started_at: now,
            ended_at: Timestamp(now.0 + 3600),
        };
        assert!(create(conn, &env, &backwards).is_err());
        assert!(create(conn, &env, &future).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn an_entry_shows_on_every_day_it_spans() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let today = Date::today();
        let midnight = today.add_days(-1).start().0;
        create(
            conn,
            &env,
            &EntryInput {
                details: details("late night", None),
                started_at: Timestamp(midnight - 3600),
                ended_at: Timestamp(midnight + 3600),
            },
        )?;
        assert_eq!(list(conn, today.add_days(-2), today.add_days(-1))?.len(), 1);
        assert_eq!(list(conn, today.add_days(-1), today)?.len(), 1);
        assert!(list(conn, today, today.add_days(1))?.is_empty());
        assert!(list(conn, today.add_days(-3), today.add_days(-2))?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn finishing_a_task_stops_the_timer_tracking_it() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let parent = tasks::create(conn, &env, &task_input("Report", None))?;
        let mut child = task_input("Outline", None);
        child.parent_id = Some(parent.id.clone());
        let child = tasks::create(conn, &env, &child)?;
        let other = tasks::create(conn, &env, &task_input("Email", None))?;
        let earlier = Timestamp(Timestamp::now().0 - 600);

        start(conn, &env, &details("", Some(&other.id)))?;
        tasks::set_completed(conn, &env, &parent.id, true)?;
        assert!(running(conn)?.is_some());

        start(conn, &env, &details("", Some(&child.id)))?;
        conn.execute("UPDATE running_timer SET started_at = ?1", params![earlier])?;
        tasks::set_completed(conn, &env, &parent.id, false)?;
        assert!(running(conn)?.is_some());
        tasks::set_completed(conn, &env, &parent.id, true)?;
        assert!(running(conn)?.is_none());
        assert!(tasks::get(conn, &child.id)?.tracked_seconds.0 >= 600);
        Ok(())
    })
    .unwrap();
}

#[test]
fn starting_a_timer_finishes_the_previous_one() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        start(conn, &env, &details("first", None))?;
        conn.execute(
            "UPDATE running_timer SET started_at = ?1",
            params![Timestamp(Timestamp::now().0 - 600)],
        )?;
        start(conn, &env, &details("second", None))?;

        let today = Date::today();
        let entries = list(conn, today.add_days(-1), today.add_days(1))?;
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].description, "first");

        stop(conn, &env)?;
        assert!(running(conn)?.is_none());
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_break_is_left_out_of_focus_time() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        start(conn, &env, &details("Write", None))?;
        let earlier = Timestamp(Timestamp::now().0 - 600);
        conn.execute("UPDATE running_timer SET started_at = ?1", params![earlier])?;
        let paused = pause(conn, &env)?;
        assert!(paused.paused_at.is_some());
        assert!((599..=601).contains(&paused.banked_seconds));
        let entries = conn.query_row("SELECT COUNT(*) FROM time_entry", [], |row| {
            row.get::<_, i64>(0)
        })?;
        assert_eq!(entries, 1);

        let break_start = Timestamp(Timestamp::now().0 - 300);
        conn.execute(
            "UPDATE running_timer SET paused_at = ?1",
            params![break_start],
        )?;
        let resumed = resume(conn, &env)?;
        assert_eq!(resumed.paused_at, None);
        assert!(resumed.started_at.0 >= Timestamp::now().0 - 1);
        assert!((599..=601).contains(&resumed.banked_seconds));

        pause(conn, &env)?;
        assert!(stop(conn, &env)?.is_none());
        assert!(running(conn)?.is_none());
        Ok(())
    })
    .unwrap();
}

#[test]
fn running_timer_survives_a_restart() {
    let dir = std::env::temp_dir().join(format!("skkil-timer-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("time.db");
    let open = || Db::new(Connection::open(&path).unwrap()).unwrap();
    open()
        .call(|conn| start(conn, &LocalEnv::default(), &details("deep work", None)))
        .unwrap();
    let reopened = open();
    let resumed = reopened.call(|conn| running(conn)).unwrap().unwrap();
    assert_eq!(resumed.description, "deep work");
    reopened.call(|conn| discard(conn)).unwrap();
    assert!(reopened.call(|conn| running(conn)).unwrap().is_none());
    std::fs::remove_dir_all(&dir).unwrap();
}

fn track(conn: &Connection, details: &EntryDetails, started_at: i64) -> TimeEntry {
    create(
        conn,
        &env(),
        &EntryInput {
            details: details.clone(),
            started_at: Timestamp(started_at),
            ended_at: Timestamp(started_at + 600),
        },
    )
    .unwrap()
}

fn project(conn: &Connection, name: &str, parent_id: Option<&Id>) -> Result<Id> {
    Ok(projects::create(conn, &env(), &project_input(name, parent_id))?.id)
}

fn entry_ids(entries: &[TrackedEntry]) -> Vec<Id> {
    entries
        .iter()
        .map(|tracked| tracked.entry.id.clone())
        .collect()
}

#[test]
fn a_task_lists_its_own_and_nested_entries_done_or_not() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let parent = tasks::create(conn, &env, &task_input("Essay", None))?;
        let mut step = task_input("Outline", None);
        step.parent_id = Some(parent.id.clone());
        let step = tasks::create(conn, &env, &step)?;
        let other = tasks::create(conn, &env, &task_input("Other", None))?;
        let own = track(conn, &details("", Some(&parent.id)), 1_000);
        let nested = track(conn, &details("", Some(&step.id)), 2_000);
        track(conn, &details("", Some(&other.id)), 3_000);

        tasks::set_completed(conn, &env, &parent.id, true)?;
        let listed = list_for_task(conn, &parent.id)?;
        assert_eq!(entry_ids(&listed), vec![nested.id, own.id]);
        assert_eq!(listed[0].task_title.as_deref(), Some("Outline"));
        assert!(listed.iter().all(|tracked| tracked.task_completed));
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_project_lists_its_subtree_and_follows_moved_tasks() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let parent = project(conn, "Parent", None)?;
        let child = project(conn, "Child", Some(&parent))?;
        let elsewhere = project(conn, "Elsewhere", None)?;
        let task = tasks::create(conn, &env, &task_input("Moved", Some(&child)))?;
        let free = EntryDetails {
            description: "Reading".into(),
            project_id: Some(parent.clone()),
            task_id: None,
        };
        let free = track(conn, &free, 1_000);
        let linked = track(conn, &details("", Some(&task.id)), 2_000);
        assert_eq!(
            entry_ids(&list_for_project(conn, &parent)?),
            vec![linked.id.clone(), free.id.clone()]
        );

        tasks::move_to(
            conn,
            &task.id,
            &tasks::TaskPlacement {
                project_id: Some(elsewhere.clone()),
                section_id: None,
                parent_id: None,
                before: None,
            },
        )?;
        assert_eq!(entry_ids(&list_for_project(conn, &parent)?), vec![free.id]);
        assert_eq!(
            entry_ids(&list_for_project(conn, &elsewhere)?),
            vec![linked.id]
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn deleting_the_linked_task_keeps_the_timer() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let task = tasks::create(conn, &env, &task_input("Draft", None))?;
        start(conn, &env, &details("", Some(&task.id)))?;
        conn.execute("DELETE FROM task WHERE id = ?1", params![task.id])?;
        assert_eq!(running(conn)?.unwrap().task_id, None);
        Ok(())
    })
    .unwrap();
}
