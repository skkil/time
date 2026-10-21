use chrono::{Local, TimeZone};
use rusqlite::params;

use super::*;
use crate::env::{Env, FixedClock, IdSource, RandomIds};
use crate::tasks;
use crate::testing::{db, task_input};
use crate::types::date;

fn clock(day: &str, minute: i32) -> Env<FixedClock, RandomIds> {
    let naive = date(day)
        .0
        .and_hms_opt(minute as u32 / 60, minute as u32 % 60, 0)
        .unwrap();
    let now = Local.from_local_datetime(&naive).earliest().unwrap();
    Env {
        clock: FixedClock(now.fixed_offset()),
        ids: RandomIds,
    }
}

fn moment(day: &str, minute: i32) -> Moment {
    Moment::at(clock(day, minute).clock.0)
}

fn kind(ritual: Option<Ritual>) -> Option<String> {
    ritual.map(|ritual| ritual.kind)
}

#[test]
fn seeds_five_templates() {
    let db = db();
    db.call(|conn| {
        let rituals = list(conn)?;
        assert_eq!(rituals.len(), 5);
        let session = get(conn, "session")?;
        assert!(session.enabled);
        assert_eq!(session.steps[0], "did_it_move");
        assert_eq!(
            get(conn, "evening")?.steps,
            ["what_moved", "leftovers", "habit_check", "one_line_note"]
        );
        assert_eq!(planning_time(conn)?, None);
        Ok(())
    })
    .unwrap();
}

#[test]
fn choosing_evening_turns_morning_off() {
    let db = db();
    db.call(|conn| {
        set_planning_time(conn, "morning")?;
        set_planning_time(conn, "evening")?;
        assert!(!get(conn, "morning")?.enabled);
        assert!(get(conn, "evening")?.enabled);
        assert_eq!(planning_time(conn)?.as_deref(), Some("evening"));
        assert!(set_planning_time(conn, "noon").is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn morning_runs_once_on_first_open() {
    let db = db();
    db.call(|conn| {
        conn.execute("UPDATE ritual SET enabled = 0 WHERE kind = 'weekly'", [])?;
        set_planning_time(conn, "morning")?;
        let eight = clock("2026-11-03", 8 * 60);
        let at = moment("2026-11-03", 8 * 60);
        assert_eq!(
            kind(due(conn, at, RitualEvent::Open)?).as_deref(),
            Some("morning")
        );
        let started = start(conn, &eight, "morning", None)?;
        assert_eq!(kind(due(conn, at, RitualEvent::Tick)?), None);

        snooze(conn, &eight, &started.id)?;
        assert!(snooze(conn, &eight, &started.id).is_err());
        let later = moment("2026-11-03", 8 * 60 + 16);
        assert_eq!(
            kind(due(conn, later, RitualEvent::Tick)?).as_deref(),
            Some("morning")
        );
        skip(conn, &started.id)?;
        assert_eq!(kind(due(conn, later, RitualEvent::Tick)?), None);
        let restarted = start(conn, &clock("2026-11-03", 8 * 60 + 16), "morning", None)?;
        assert_eq!(restarted.id, started.id);
        Ok(())
    })
    .unwrap();
}

#[test]
fn evening_follows_the_clock_or_the_last_block() {
    let db = db();
    db.call(|conn| {
        conn.execute("UPDATE ritual SET enabled = 0 WHERE kind = 'weekly'", [])?;
        set_planning_time(conn, "evening")?;
        let day = "2026-11-03";
        assert_eq!(
            kind(due(conn, moment(day, 16 * 60), RitualEvent::Tick)?),
            None
        );
        let task = tasks::create(conn, &clock(day, 9 * 60), &task_input("Write", None))?;
        let start_at = moment(day, 14 * 60).stamp;
        let end_at = moment(day, 15 * 60 + 30).stamp;
        conn.execute(
            "INSERT INTO time_block (id, task_id, start_at, end_at) VALUES (?1, ?2, ?3, ?4)",
            params![RandomIds.next_id(), task.id, start_at, end_at],
        )?;
        assert_eq!(
            kind(due(conn, moment(day, 16 * 60), RitualEvent::Tick)?).as_deref(),
            Some("evening")
        );
        assert_eq!(
            kind(due(
                conn,
                moment("2026-11-04", 17 * 60 + 30),
                RitualEvent::Tick
            )?)
            .as_deref(),
            Some("evening")
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn session_close_needs_a_long_enough_timer() {
    let db = db();
    db.call(|conn| {
        conn.execute("UPDATE ritual SET enabled = 0 WHERE kind = 'weekly'", [])?;
        let ten = clock("2026-11-03", 10 * 60);
        let at = moment("2026-11-03", 10 * 60);
        assert_eq!(
            kind(due(conn, at, RitualEvent::TimerStopped { minutes: 12 })?),
            None
        );
        assert_eq!(
            kind(due(conn, at, RitualEvent::TimerStopped { minutes: 25 })?).as_deref(),
            Some("session")
        );
        let first = start(conn, &ten, "session", None)?;
        finish(conn, &ten, &first.id)?;
        assert_ne!(start(conn, &ten, "session", None)?.id, first.id);
        Ok(())
    })
    .unwrap();
}

#[test]
fn weekly_waits_for_its_day_and_an_unreviewed_week() {
    let db = db();
    db.call(|conn| {
        let monday = moment("2026-11-02", 9 * 60);
        let tuesday = moment("2026-11-03", 9 * 60);
        assert_eq!(
            kind(due(conn, monday, RitualEvent::Open)?).as_deref(),
            Some("weekly")
        );
        assert_eq!(kind(due(conn, tuesday, RitualEvent::Open)?), None);
        conn.execute(
            "INSERT INTO week (start_date, reviewed_at) VALUES ('2026-10-26', 1)",
            [],
        )?;
        assert_eq!(kind(due(conn, monday, RitualEvent::Open)?), None);
        Ok(())
    })
    .unwrap();
}

#[test]
fn validates_steps_and_triggers() {
    let db = db();
    db.call(|conn| {
        let input = |trigger: &str, steps: &[&str]| RitualInput {
            enabled: true,
            trigger: trigger.into(),
            at_minute: 1050,
            weekdays: 127,
            steps: steps.iter().map(|step| (*step).to_owned()).collect(),
        };
        assert!(update(conn, "evening", &input("at_time", &["feel", "nope"])).is_err());
        assert!(update(conn, "evening", &input("at_time", &[])).is_err());
        assert!(update(conn, "evening", &input("after_timer_stop", &["feel"])).is_err());
        assert!(update(conn, "evening", &input("at_time", &["feel", "feel"])).is_err());
        let evening = update(
            conn,
            "evening",
            &input("at_time", &["one_line_note", "feel"]),
        )?;
        assert_eq!(evening.steps, ["one_line_note", "feel"]);
        let weekly = update(conn, "weekly", &input("first_open", &["feel"]))?;
        assert_eq!(weekly.steps, ["weekly_review"]);
        Ok(())
    })
    .unwrap();
}
