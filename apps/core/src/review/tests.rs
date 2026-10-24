use super::*;
use crate::testing::{db, env, task_input};
use crate::types::{Date, Seconds, Timestamp, date};
use crate::{blocks, tasks, time_entries};

#[test]
fn numbers_weeks_inside_the_quarter() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        save_quarter(conn, &env, None, "2026 Q4", date("2026-09-30"))?;
        let week = |d: &str| quarter_for(conn, date(d)).map(|q| q.map(|q| q.week_no));
        assert_eq!(week("2026-09-28")?, Some(1));
        assert_eq!(week("2026-11-01")?, Some(5));
        assert_eq!(week("2026-12-27")?, Some(13));
        assert_eq!(week("2026-12-28")?, None);
        assert_eq!(week("2026-09-27")?, None);
        Ok(())
    })
    .unwrap();
}

#[test]
fn caps_open_outcomes_at_three() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let monday = date("2026-11-02");
        for title in ["A", "B", "C"] {
            add_outcome(conn, &env, monday, title, None)?;
        }
        assert!(add_outcome(conn, &env, monday.add_days(3), "D", None).is_err());

        let first = week(conn, monday)?.outcomes[0].id.clone();
        set_outcome_status(conn, &env, &first, OutcomeStatus::Achieved)?;
        add_outcome(conn, &env, monday, "D", None)?;
        assert!(set_outcome_status(conn, &env, &first, OutcomeStatus::Open).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn carrying_moves_open_tasks_and_undoing_moves_them_back() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let monday = date("2026-11-02");
        add_outcome(conn, &env, monday, "Ship beta", None)?;
        let outcome = week(conn, monday)?.outcomes[0].id.clone();
        let done = tasks::create(conn, &env, &task_input("Write docs", None))?;
        let open = tasks::create(conn, &env, &task_input("Fix login", None))?;
        tasks::set_outcome(conn, &done.id, Some(&outcome))?;
        tasks::set_outcome(conn, &open.id, Some(&outcome))?;
        tasks::set_completed(conn, &env, &done.id, true)?;

        let evidence = &week(conn, monday)?.outcomes[0];
        assert_eq!((evidence.tasks_done, evidence.tasks_total), (1, 2));

        set_outcome_status(conn, &env, &outcome, OutcomeStatus::Carried)?;
        let next = week(conn, monday.add_days(7))?.outcomes.remove(0);
        assert_eq!(next.carried_from, Some(outcome.clone()));
        assert_eq!(tasks::get(conn, &open.id)?.outcome_id, Some(next.id));
        assert_eq!(
            tasks::get(conn, &done.id)?.outcome_id,
            Some(outcome.clone())
        );

        set_outcome_status(conn, &env, &outcome, OutcomeStatus::Achieved)?;
        assert!(week(conn, monday.add_days(7))?.outcomes.is_empty());
        assert_eq!(
            tasks::get(conn, &open.id)?.outcome_id,
            Some(outcome.clone())
        );

        set_outcome_status(conn, &env, &outcome, OutcomeStatus::Carried)?;
        let second = week(conn, monday.add_days(7))?.outcomes[0].id.clone();
        set_outcome_status(conn, &env, &second, OutcomeStatus::Carried)?;
        let third = week(conn, monday.add_days(14))?.outcomes.remove(0);
        assert_eq!(third.times_carried, 2);
        assert!(set_outcome_status(conn, &env, &third.id, OutcomeStatus::Carried).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn tracks_week_review_progress() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let monday = date("2026-11-02");
        set_week_felt(conn, monday, 3)?;
        set_week_step(conn, monday, 2)?;
        set_week_step(conn, monday, 1)?;
        assert_eq!(week(conn, monday)?.step, 2);
        assert!(week(conn, monday)?.reviewed_at.is_none());
        finish_week(conn, &env, monday.add_days(2))?;
        let summary = &weeks(conn, monday, monday.add_days(7))?[0];
        assert_eq!(summary.felt, Some(3));
        assert!(summary.reviewed_at.is_some());
        Ok(())
    })
    .unwrap();
}

#[test]
fn summarises_tracked_and_planned_time_by_start() {
    let entry = || time_entries::EntryDetails {
        description: String::new(),
        project_id: None,
        task_id: None,
    };
    let (db, env) = (db(), env());
    db.call(|conn| {
        let monday = date("2026-11-02");
        let task = tasks::create(conn, &env, &task_input("Write", None))?;
        let late_sunday = Timestamp(monday.start().0 - 1800);
        time_entries::create(
            conn,
            &env,
            &time_entries::EntryInput {
                details: entry(),
                started_at: late_sunday,
                ended_at: Timestamp(late_sunday.0 + 3600),
            },
        )?;
        time_entries::create(
            conn,
            &env,
            &time_entries::EntryInput {
                details: entry(),
                started_at: Timestamp(monday.start().0 + 3600),
                ended_at: Timestamp(monday.start().0 + 5400),
            },
        )?;
        blocks::create(
            conn,
            &env,
            &task.id,
            &blocks::BlockSpan {
                start_at: Timestamp(monday.start().0 + 7200),
                end_at: Timestamp(monday.start().0 + 14400),
            },
        )?;

        let mut timed = task_input("Call the bank", None);
        timed.due_date = Some(monday.add_days(2));
        timed.due_time = Some(600);
        timed.estimate_minutes = Some(30);
        tasks::create(conn, &env, &timed)?;

        let summaries = weeks(conn, monday.add_days(-7), monday.add_days(7))?;
        assert_eq!(summaries.len(), 2);
        assert_eq!(summaries[0].start_date, monday);
        assert_eq!(summaries[0].tracked_seconds, Seconds(1800));
        assert_eq!(summaries[0].planned_seconds, Seconds(7200 + 1800));
        assert_eq!(summaries[1].tracked_seconds, Seconds(3600));
        assert_eq!(summaries[1].reviewed_at, None);
        Ok(())
    })
    .unwrap();
}

#[test]
fn rates_past_days_only() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let today = Date::today();
        skip_day(conn, today)?;
        set_day_felt(conn, &env, today, 4)?;
        set_day_note(conn, &env, today, "steady")?;
        assert!(set_day_felt(conn, &env, today.add_days(1), 4).is_err());
        assert!(set_day_felt(conn, &env, today, 6).is_err());
        let day = &days(conn, today, today.add_days(1))?[0];
        assert_eq!(
            (day.felt, day.note.as_str(), day.skipped),
            (Some(4), "steady", false)
        );
        Ok(())
    })
    .unwrap();
}
