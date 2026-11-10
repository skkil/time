use super::*;
use crate::blocks::{self, BlockSpan};
use crate::tasks;
use crate::testing::{db, env, task_input};
use crate::types::date;

const TODAY: &str = "2026-11-10";

fn at(minute: i64) -> Timestamp {
    Timestamp(date(TODAY).start().0 + minute * 60)
}

fn task(conn: &Connection, title: &str) -> Result<Id> {
    Ok(tasks::create(conn, &env(), &task_input(title, None))?.id)
}

fn dated(conn: &Connection, title: &str, day: &str, minute: Option<i32>) -> Result<Id> {
    let mut input = task_input(title, None);
    input.due_date = Some(date(day));
    input.due_time = minute;
    Ok(tasks::create(conn, &env(), &input)?.id)
}

fn block(conn: &Connection, task: &Id, from: i64, to: i64) -> Result<()> {
    let span = BlockSpan {
        start_at: at(from),
        end_at: at(to),
    };
    blocks::create(conn, &env(), task, &span)?;
    Ok(())
}

#[test]
fn shows_the_block_under_way_and_what_comes_next_today() {
    let db = db();
    db.call(|conn| {
        let write = task(conn, "Write")?;
        block(conn, &write, 9 * 60, 11 * 60)?;
        dated(conn, "Call", TODAY, Some(14 * 60))?;
        let read = task(conn, "Read")?;
        block(conn, &read, 13 * 60, 14 * 60)?;
        dated(conn, "Tomorrow", "2026-11-11", Some(8 * 60))?;

        let glance = today_glance(conn, at(10 * 60), date(TODAY))?;
        let now = glance.now.expect("a block is under way");
        assert_eq!((now.kind, now.title.as_str()), (GlanceKind::Block, "Write"));
        let next = glance.next.expect("something comes next");
        assert_eq!(
            (next.kind, next.title.as_str()),
            (GlanceKind::Block, "Read")
        );

        let late = today_glance(conn, at(13 * 60 + 30), date(TODAY))?;
        assert_eq!(late.now.map(|item| item.title), Some("Read".into()));
        assert_eq!(
            late.next.map(|item| (item.kind, item.title)),
            Some((GlanceKind::Task, "Call".into()))
        );

        let evening = today_glance(conn, at(20 * 60), date(TODAY))?;
        assert!(evening.now.is_none() && evening.next.is_none());
        Ok(())
    })
    .unwrap();
}

#[test]
fn lists_todays_musts_and_counts_earlier_work() {
    let db = db();
    db.call(|conn| {
        let env = env();
        let first = task(conn, "Thesis")?;
        tasks::set_must(conn, &first, Some(date(TODAY)))?;
        dated(conn, "Overdue", "2026-11-08", None)?;
        let parked = dated(conn, "Parked", "2026-11-07", None)?;
        tasks::set_someday(conn, std::slice::from_ref(&parked), true)?;
        let done = dated(conn, "Done", "2026-11-07", None)?;
        tasks::set_completed(conn, &env, &done, true)?;
        let pulled = dated(conn, "Pulled in", "2026-11-09", None)?;
        tasks::set_must(conn, &pulled, Some(date(TODAY)))?;

        let glance = today_glance(conn, at(9 * 60), date(TODAY))?;
        assert_eq!(
            glance
                .musts
                .iter()
                .map(|task| task.title.as_str())
                .collect::<Vec<_>>(),
            vec!["Thesis", "Pulled in"]
        );
        assert_eq!(glance.earlier_count, 1);
        assert!(glance.timer.is_none());
        Ok(())
    })
    .unwrap();
}
