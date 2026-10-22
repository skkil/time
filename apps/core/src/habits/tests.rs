use chrono::Datelike;
use rusqlite::Connection;
use serde_json::json;

use super::activity::Event;
use super::*;
use crate::error::Result;
use crate::testing::{db, env, project_input};
use crate::types::{Date, Id, Timestamp};
use crate::{projects, time_entries};

pub fn input(name: &str, kind: &str) -> HabitInput {
    HabitInput {
        name: name.into(),
        kind: kind.into(),
        goal: 1.0,
        unit: "times".into(),
        days: ALL_DAYS,
        time_of_day: "anytime".into(),
        area: String::new(),
        start_date: Date::today().add_days(-10),
        tracking: None,
        skip_days: 0,
        anchor: String::new(),
    }
}

fn status_on(conn: &Connection, habit: &Id, date: Date) -> DayStatus {
    days(conn, date, date.add_days(1))
        .unwrap()
        .into_iter()
        .find(|day| &day.habit_id == habit)
        .unwrap()
        .status
}

#[test]
fn build_habits_count_toward_a_goal() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let mut water = input("Drink water", "build");
        water.goal = 3.0;
        let water = create(conn, &env, &water)?;
        let today = Date::today();
        add_value(conn, &env, &water.id, today, 2.0)?;
        assert_eq!(status_on(conn, &water.id, today), DayStatus::Pending);
        add_value(conn, &env, &water.id, today, 1.0)?;
        assert_eq!(status_on(conn, &water.id, today), DayStatus::Done);
        assert_eq!(
            status_on(conn, &water.id, today.add_days(-1)),
            DayStatus::Missed
        );
        set_status(
            conn,
            &env,
            &water.id,
            today.add_days(-1),
            Some(ManualStatus::Skipped),
        )?;
        assert_eq!(
            status_on(conn, &water.id, today.add_days(-1)),
            DayStatus::Skipped
        );
        let water = get(conn, &water.id)?;
        assert_eq!((water.done_days, water.due_days), (1, 10));
        assert!(add_value(conn, &env, &water.id, today.add_days(1), 1.0).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn quit_habits_hold_until_a_slip() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let habit = create(conn, &env, &input("No doomscrolling", "quit"))?;
        let today = Date::today();
        assert_eq!(habit.goal, 0.0);
        assert_eq!(
            status_on(conn, &habit.id, today.add_days(-3)),
            DayStatus::Done
        );
        assert_eq!(status_on(conn, &habit.id, today), DayStatus::Pending);
        assert_eq!((habit.done_days, habit.due_days), (10, 10));
        assert_eq!(habit.clean_since, Some(today.add_days(-10)));

        set_status(
            conn,
            &env,
            &habit.id,
            today.add_days(-4),
            Some(ManualStatus::Failed),
        )?;
        let habit = get(conn, &habit.id)?;
        assert_eq!((habit.done_days, habit.due_days), (9, 10));
        assert_eq!(habit.clean_since, Some(today.add_days(-3)));
        Ok(())
    })
    .unwrap();
}

#[test]
fn planned_skip_days_forgive_one_miss_a_week() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let today = Date::today();
        let mut walk = input("Walk", "build");
        walk.start_date = today.add_days(-6);
        walk.skip_days = 1;
        walk.anchor = "After lunch".into();
        let walk = create(conn, &env, &walk)?;
        let weeks: std::collections::HashSet<_> =
            (1..=6).map(|back| today.add_days(-back).monday()).collect();
        assert_eq!(walk.done_days, 0);
        assert_eq!(walk.due_days, 6 - weeks.len() as i32);
        assert_eq!(walk.anchor, "After lunch");

        walk_input_rejects_three_skips(conn)
    })
    .unwrap();
}

fn walk_input_rejects_three_skips(conn: &Connection) -> Result<()> {
    let mut walk = input("Walk", "build");
    walk.skip_days = 3;
    assert!(create(conn, &env(), &walk).is_err());
    Ok(())
}

#[test]
fn repeat_days_turn_other_days_off() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let mut gym = input("Gym", "build");
        let today = Date::today();
        gym.days = 1 << today.0.weekday().num_days_from_monday();
        let gym = create(conn, &env, &gym)?;
        assert_eq!(status_on(conn, &gym.id, today), DayStatus::Pending);
        assert_eq!(status_on(conn, &gym.id, today.add_days(-1)), DayStatus::Off);
        assert_eq!(
            status_on(conn, &gym.id, today.add_days(-7)),
            DayStatus::Missed
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn website_tracking_fails_a_quit_habit_and_respects_overrides() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let mut quit = input("Stay off YouTube", "quit");
        quit.tracking = Some(Tracking {
            source: "website".into(),
            patterns: vec!["https://www.YouTube.com/feed".into()],
            project_id: None,
        });
        let quit = create(conn, &env, &quit)?;
        assert_eq!(quit.tracking.as_ref().unwrap().patterns, ["youtube.com"]);

        let today = Date::today();
        let yesterday = today.add_days(-1);
        let at = |day: Date, url: &str| Event {
            timestamp: chrono::DateTime::from_timestamp(day.start().0 + 3600, 0).unwrap(),
            duration: 120.0,
            data: json!({ "url": url }),
        };
        let web = vec![
            at(yesterday, "https://m.youtube.com/watch"),
            at(today, "https://docs.rs/"),
        ];
        record_measurements(
            conn,
            &env,
            &measure_activity(&[get(conn, &quit.id)?], &web, &[], today),
        )?;

        assert_eq!(status_on(conn, &quit.id, yesterday), DayStatus::Failed);
        assert_eq!(status_on(conn, &quit.id, today), DayStatus::Pending);
        assert_eq!(get(conn, &quit.id)?.clean_since, Some(today));
        assert!(add_value(conn, &env, &quit.id, today, 1.0).is_err());

        set_status(conn, &env, &quit.id, yesterday, Some(ManualStatus::Skipped))?;
        record_measurements(
            conn,
            &env,
            &measure_activity(&[get(conn, &quit.id)?], &web, &[], today),
        )?;
        assert_eq!(status_on(conn, &quit.id, yesterday), DayStatus::Skipped);
        set_status(conn, &env, &quit.id, yesterday, None)?;
        assert_eq!(status_on(conn, &quit.id, yesterday), DayStatus::Failed);
        Ok(())
    })
    .unwrap();
}

#[test]
fn limit_habits_allow_usage_up_to_the_goal() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let mut games = input("Games under 30 min", "limit");
        games.goal = 30.0;
        games.unit = "minutes".into();
        games.tracking = Some(Tracking {
            source: "app".into(),
            patterns: vec!["steam".into()],
            project_id: None,
        });
        let games = create(conn, &env, &games)?;
        let today = Date::today();
        let play = |day: Date, minutes: f64| Event {
            timestamp: chrono::DateTime::from_timestamp(day.start().0 + 7200, 0).unwrap(),
            duration: minutes * 60.0,
            data: json!({ "app": "steam", "title": "Library" }),
        };
        let windows = vec![
            play(today.add_days(-2), 20.0),
            play(today.add_days(-1), 45.0),
        ];
        record_measurements(
            conn,
            &env,
            &measure_activity(&[get(conn, &games.id)?], &[], &windows, today),
        )?;
        assert_eq!(
            status_on(conn, &games.id, today.add_days(-2)),
            DayStatus::Done
        );
        assert_eq!(
            status_on(conn, &games.id, today.add_days(-1)),
            DayStatus::Failed
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn project_time_completes_a_build_habit() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let study = projects::create(conn, &env, &project_input("Study", None))?;
        let mut habit = input("Study 1h", "build");
        habit.goal = 60.0;
        habit.unit = "times".into();
        habit.tracking = Some(Tracking {
            source: "project".into(),
            patterns: Vec::new(),
            project_id: Some(study.id.clone()),
        });
        let habit = create(conn, &env, &habit)?;
        assert_eq!(habit.unit, "minutes");

        let yesterday = Date::today().add_days(-1);
        let start = yesterday.start().0 + 9 * 3600;
        time_entries::create(
            conn,
            &env,
            &time_entries::EntryInput {
                details: time_entries::EntryDetails {
                    description: "Chapter 3".into(),
                    project_id: Some(study.id.clone()),
                    task_id: None,
                },
                started_at: Timestamp(start),
                ended_at: Timestamp(start + 75 * 60),
            },
        )?;
        sync_projects(conn, &[get(conn, &habit.id)?], Date::today())?;
        assert_eq!(status_on(conn, &habit.id, yesterday), DayStatus::Done);
        Ok(())
    })
    .unwrap();
}
