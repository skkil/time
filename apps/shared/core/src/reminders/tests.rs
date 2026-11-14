use super::*;
use crate::blocks::{self, BlockSpan};
use crate::tasks;
use crate::testing::{db, env, task_input};
use crate::types::date;

const ALL: NotificationPrefs = NotificationPrefs {
    on: true,
    tasks: true,
    blocks: true,
    events: true,
};

fn at(day: &str, minute: i64) -> Timestamp {
    Timestamp(date(day).start().0 + minute * 60)
}

fn timed(conn: &Connection, title: &str, day: &str, minute: i32) -> Result<Id> {
    let mut input = task_input(title, None);
    input.due_date = Some(date(day));
    input.due_time = Some(minute);
    Ok(tasks::create(conn, &env(), &input)?.id)
}

fn keys(list: &[Reminder]) -> Vec<(ReminderKind, String)> {
    list.iter().map(|r| (r.kind, r.title.clone())).collect()
}

#[test]
fn reminds_a_timed_task_once_at_its_time() {
    let db = db();
    db.call(|conn| {
        timed(conn, "Call dentist", "2026-11-07", 20 * 60)?;
        let window = |from, to| upcoming(conn, at("2026-11-07", from), at("2026-11-07", to), &ALL);

        assert!(window(19 * 60, 20 * 60 - 1)?.is_empty());
        let fired = window(20 * 60 - 1, 20 * 60)?;
        assert_eq!(
            keys(&fired),
            vec![(ReminderKind::Task, "Call dentist".into())]
        );
        assert_eq!(fired[0].at, at("2026-11-07", 20 * 60));
        assert!(window(20 * 60, 21 * 60)?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn reminds_blocks_as_they_start_and_skips_finished_work() {
    let db = db();
    db.call(|conn| {
        let env = env();
        let write = tasks::create(conn, &env, &task_input("Write", None))?;
        let done = timed(conn, "Done", "2026-11-07", 9 * 60)?;
        for task in [&write.id, &done] {
            let span = BlockSpan {
                start_at: at("2026-11-07", 10 * 60),
                end_at: at("2026-11-07", 11 * 60),
            };
            blocks::create(conn, &env, task, &span)?;
        }
        tasks::set_completed(conn, &env, &done, true)?;

        let found = upcoming(conn, at("2026-11-07", 0), at("2026-11-07", 12 * 60), &ALL)?;
        assert_eq!(keys(&found), vec![(ReminderKind::Block, "Write".into())]);
        assert!(found[0].block_id.is_some());
        Ok(())
    })
    .unwrap();
}

#[test]
fn reminds_events_ahead_of_time_and_never_as_tasks() {
    let db = db();
    db.call(|conn| {
        let env = env();
        let project = crate::testing::project(conn, "Uni")?;
        let lecture = workflow::create_type(
            conn,
            &env,
            &project,
            &workflow::ItemTypeInput {
                name: "Lecture".into(),
                icon: "book".into(),
                kind: "event".into(),
                default_minutes: Some(90),
                checklist: String::new(),
            },
        )?;
        let mut input = task_input("Algorithms", Some(&project));
        input.due_date = Some(date("2026-11-07"));
        input.due_time = Some(14 * 60);
        let event = tasks::create(conn, &env, &input)?;
        workflow::set_task_type(conn, &env, &event.id, Some(&lecture))?;

        let found = upcoming(
            conn,
            at("2026-11-07", 13 * 60),
            at("2026-11-07", 14 * 60),
            &ALL,
        )?;
        assert_eq!(
            keys(&found),
            vec![(ReminderKind::Event, "Algorithms".into())]
        );
        assert_eq!(found[0].at, at("2026-11-07", 14 * 60 - EVENT_LEAD_MINUTES));
        assert_eq!(found[0].starts_at, at("2026-11-07", 14 * 60));
        Ok(())
    })
    .unwrap();
}

#[test]
fn follows_the_account_and_device_switches() {
    let db = db();
    db.call(|conn| {
        timed(conn, "Call", "2026-11-07", 9 * 60)?;
        let window = |prefs: &NotificationPrefs| {
            upcoming(conn, at("2026-11-07", 0), at("2026-11-07", 23 * 60), prefs)
        };
        assert_eq!(window(&ALL)?.len(), 1);
        assert!(
            window(&NotificationPrefs {
                tasks: false,
                ..ALL
            })?
            .is_empty()
        );
        assert!(window(&NotificationPrefs { on: false, ..ALL })?.is_empty());

        assert_eq!(device_prefs(conn)?, NotificationPrefs::default());
        let quiet = NotificationPrefs {
            blocks: false,
            ..ALL
        };
        set_device_prefs(conn, &quiet)?;
        assert_eq!(device_prefs(conn)?, quiet);

        set_enabled(conn, &env(), false)?;
        assert!(!enabled(conn)?);
        assert!(window(&ALL)?.is_empty());
        Ok(())
    })
    .unwrap();
}
