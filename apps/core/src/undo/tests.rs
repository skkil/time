use rusqlite::params;

use super::*;
use crate::blocks::{self, BlockSpan};
use crate::testing::{db, env, task_input as input};
use crate::types::{Date, Id, Timestamp, date};
use crate::{dependencies, tasks, time_entries};

fn span(start: i64) -> BlockSpan {
    BlockSpan {
        start_at: Timestamp(start),
        end_at: Timestamp(start + 3600),
    }
}

#[test]
fn deleted_tasks_return_with_steps_blocks_links_and_history() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let task = tasks::create(conn, &env, &input("Write intro", None))?;
        let mut step = input("Outline", None);
        step.parent_id = Some(task.id.clone());
        let step = tasks::create(conn, &env, &step)?;
        let held = tasks::create(conn, &env, &input("Send draft", None))?;
        dependencies::add(conn, &held.id, &task.id)?;
        let start = date("2026-11-02").start().0;
        blocks::create(conn, &env, &task.id, &span(start))?;
        let entry = time_entries::create(
            conn,
            &env,
            &time_entries::EntryInput {
                details: time_entries::EntryDetails {
                    description: String::new(),
                    project_id: None,
                    task_id: Some(task.id.clone()),
                },
                started_at: Timestamp(start),
                ended_at: Timestamp(start + 600),
            },
        )?;

        let snapshot = capture(conn, std::slice::from_ref(&task.id))?;
        tasks::delete(conn, &task.id)?;
        assert!(tasks::get(conn, &step.id).is_err());

        restore(conn, &snapshot)?;

        assert_eq!(tasks::get(conn, &task.id)?.title, "Write intro");
        assert_eq!(tasks::get(conn, &step.id)?.parent_id, Some(task.id.clone()));
        assert_eq!(
            tasks::get(conn, &held.id)?.blocked_by,
            vec![task.id.clone()]
        );
        let monday = date("2026-11-02");
        assert_eq!(blocks::list(conn, monday, monday.add_days(7))?.len(), 1);
        let linked: Option<Id> = conn.query_row(
            "SELECT task_id FROM time_entry WHERE id = ?1",
            params![entry.id],
            |row| row.get(0),
        )?;
        assert_eq!(linked, Some(task.id));
        Ok(())
    })
    .unwrap();
}

#[test]
fn undoing_done_reopens_steps_and_rewinds_a_repeat() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let parent = tasks::create(conn, &env, &input("Pack", None))?;
        let mut step = input("Socks", None);
        step.parent_id = Some(parent.id.clone());
        let step = tasks::create(conn, &env, &step)?;
        let snapshot = capture(conn, std::slice::from_ref(&parent.id))?;
        tasks::set_completed(conn, &env, &parent.id, true)?;
        restore(conn, &snapshot)?;
        assert!(tasks::get(conn, &parent.id)?.completed_at.is_none());
        assert!(tasks::get(conn, &step.id)?.completed_at.is_none());

        let mut repeat = input("Water plants", None);
        repeat.due_date = Some(Date::today());
        repeat.recurrence = Some("every day".into());
        let repeat = tasks::create(conn, &env, &repeat)?;
        let due = repeat.due_date;
        let snapshot = capture(conn, std::slice::from_ref(&repeat.id))?;
        tasks::set_completed(conn, &env, &repeat.id, true)?;
        assert_ne!(tasks::get(conn, &repeat.id)?.due_date, due);
        restore(conn, &snapshot)?;
        assert_eq!(tasks::get(conn, &repeat.id)?.due_date, due);
        Ok(())
    })
    .unwrap();
}

#[test]
fn refuses_to_overwrite_a_task_that_reused_the_id() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let task = tasks::create(conn, &env, &input("Old", None))?;
        let snapshot = capture(conn, std::slice::from_ref(&task.id))?;
        tasks::delete(conn, &task.id)?;
        conn.execute(
            "INSERT INTO task (id, title, created_at) VALUES (?1, 'New', 1)",
            params![task.id],
        )?;

        assert!(restore(conn, &snapshot).is_err());
        assert_eq!(tasks::get(conn, &task.id)?.title, "New");
        Ok(())
    })
    .unwrap();
}

#[test]
fn the_log_keeps_only_recent_snapshots() {
    let db = db();
    let log = UndoLog::default();
    let first = db
        .call(|conn| capture(conn, &[]))
        .map(|snapshot| log.keep(snapshot))
        .unwrap();
    for _ in 0..KEPT_SNAPSHOTS {
        log.keep(db.call(|conn| capture(conn, &[])).unwrap());
    }
    assert!(log.take(&first).is_none());
}
