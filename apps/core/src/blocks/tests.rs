use super::*;
use crate::tasks;
use crate::testing::{db, env, task_input};
use crate::types::{Timestamp, date};

#[test]
fn schedules_tasks_and_cascades_on_delete() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let task = tasks::create(conn, &env, &task_input("Write intro", None))?;
        let monday = date("2026-11-02");
        let start = Timestamp(monday.start().0 + 9 * 3600);
        let span = BlockSpan {
            start_at: start,
            end_at: Timestamp(start.0 + 3600),
        };
        let block = create(conn, &env, &task.id, &span)?;
        assert_eq!(block.title, "Write intro");
        assert_eq!(list(conn, monday, monday.add_days(7))?.len(), 1);

        tasks::delete(conn, &task.id)?;
        assert!(list(conn, monday, monday.add_days(7))?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn rejects_bad_spans() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let task = tasks::create(conn, &env, &task_input("Read", None))?;
        let backwards = BlockSpan {
            start_at: Timestamp(7200),
            end_at: Timestamp(3600),
        };
        let ragged = BlockSpan {
            start_at: Timestamp(3601),
            end_at: Timestamp(7200),
        };
        assert!(create(conn, &env, &task.id, &backwards).is_err());
        assert!(create(conn, &env, &task.id, &ragged).is_err());
        Ok(())
    })
    .unwrap();
}
