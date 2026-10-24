use rusqlite::{Connection, params};

use super::*;
use crate::tasks;
use crate::testing::{db, env, task_input};
use crate::types::date;

fn timed(conn: &Connection, title: &str, day: &str, minute: i32) -> Result<Id> {
    let mut input = task_input(title, None);
    input.due_date = Some(date(day));
    input.due_time = Some(minute);
    Ok(tasks::create(conn, &env(), &input)?.id)
}

#[test]
fn fires_once_at_the_due_time() {
    let db = db();
    db.call(|conn| {
        let today = date("2026-11-07");
        let id = timed(conn, "Call dentist", "2026-11-07", 20 * 60)?;

        assert!(take_due(conn, today, 20 * 60 - 1)?.is_empty());
        let fired = take_due(conn, today, 20 * 60)?;
        assert_eq!(fired.len(), 1);
        assert_eq!(fired[0].task_id, id);
        assert!(take_due(conn, today, 20 * 60 + 1)?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn skips_old_finished_and_other_days() {
    let db = db();
    db.call(|conn| {
        let today = date("2026-11-07");
        timed(conn, "Long gone", "2026-11-07", 8 * 60)?;
        timed(conn, "Tomorrow", "2026-11-08", 12 * 60)?;
        let done = timed(conn, "Done", "2026-11-07", 12 * 60)?;
        tasks::set_completed(conn, &env(), &done, true)?;

        assert!(take_due(conn, today, 12 * 60)?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn fires_again_after_a_reschedule() {
    let db = db();
    db.call(|conn| {
        let today = date("2026-11-07");
        let id = timed(conn, "Call", "2026-11-07", 9 * 60)?;
        assert_eq!(take_due(conn, today, 9 * 60)?.len(), 1);

        conn.execute(
            "UPDATE task SET due_time = ?1 WHERE id = ?2",
            params![10 * 60, id],
        )?;

        assert_eq!(take_due(conn, today, 10 * 60)?.len(), 1);
        Ok(())
    })
    .unwrap();
}

#[test]
fn stays_on_until_turned_off() {
    let db = db();
    db.call(|conn| {
        assert!(enabled(conn)?);
        set_enabled(conn, false)?;
        assert!(!enabled(conn)?);
        Ok(())
    })
    .unwrap();
}
