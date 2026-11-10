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

mod logging {
    use chrono::{FixedOffset, TimeZone};

    use super::*;
    use crate::env::{Env, FixedClock, MutationEnv, RandomIds};
    use crate::time_entries::{self, EntryDetails, EntryInput};
    use crate::types::Id;

    const NOW: i64 = 1_793_700_000;

    fn at(seconds: i64) -> Env<FixedClock, RandomIds> {
        let now = FixedOffset::east_opt(0)
            .unwrap()
            .timestamp_opt(seconds, 0)
            .unwrap();
        Env {
            clock: FixedClock(now),
            ids: RandomIds,
        }
    }

    fn plan(
        conn: &rusqlite::Connection,
        env: &dyn MutationEnv,
        task: &Id,
        start: i64,
    ) -> TimeBlock {
        let span = BlockSpan {
            start_at: Timestamp(start),
            end_at: Timestamp(start + 3600),
        };
        create(conn, env, task, &span).unwrap()
    }

    fn entries(conn: &rusqlite::Connection) -> Vec<time_entries::TimeEntry> {
        time_entries::list(conn, date("2026-10-01"), date("2026-12-01")).unwrap()
    }

    #[test]
    fn logs_an_ended_block_once_as_tracked_time() {
        let (db, env) = (db(), at(NOW));
        db.call(|conn| {
            let task = tasks::create(conn, &env, &task_input("Write intro", None))?;
            plan(conn, &env, &task.id, NOW - 7200);
            plan(conn, &env, &task.id, NOW + 600);

            assert_eq!(count_ended(conn, env.timestamp())?, 1);
            assert_eq!(log_ended(conn, &env)?, 1);
            let logged = entries(conn);
            assert_eq!(logged.len(), 1);
            assert_eq!(logged[0].source, "block");
            assert_eq!(logged[0].description, "Write intro");
            assert_eq!(
                (logged[0].started_at.0, logged[0].ended_at.0),
                (NOW - 7200, NOW - 3600)
            );

            time_entries::delete(conn, &logged[0].id)?;
            assert_eq!(log_ended(conn, &env)?, 0);
            assert!(entries(conn).is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn skips_blocks_already_tracked_and_respects_the_switch() {
        let (db, env) = (db(), at(NOW));
        db.call(|conn| {
            let task = tasks::create(conn, &env, &task_input("Review", None))?;
            plan(conn, &env, &task.id, NOW - 7200);
            let details = EntryDetails {
                description: "Review".into(),
                project_id: None,
                task_id: Some(task.id.clone()),
            };
            let input = EntryInput {
                details,
                started_at: Timestamp(NOW - 7000),
                ended_at: Timestamp(NOW - 6000),
            };
            time_entries::create(conn, &env, &input)?;
            assert_eq!(log_ended(conn, &env)?, 0);
            assert_eq!(entries(conn).len(), 1);

            plan(conn, &env, &task.id, NOW - 19_800);
            set_auto_log(conn, &env, false)?;
            assert_eq!(count_ended(conn, env.timestamp())?, 0);
            assert_eq!(log_ended(conn, &env)?, 0);
            set_auto_log(conn, &env, true)?;
            assert_eq!(log_ended(conn, &env)?, 1);
            Ok(())
        })
        .unwrap();
    }
}
