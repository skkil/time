use chrono::Days;
use rusqlite::{Connection, OptionalExtension, params};

use super::activity::{self, Event, Usage};
use super::model::{Habit, HabitMeasurement, SYNC_DAYS};
use super::queries::{active, get};
use super::rules::ensure_loggable;
use crate::env::{MutationEnv, NaturalKey};
use crate::error::{Error, Result};
use crate::types::{Date, Id, Timestamp};

/// Active habits that measure something on their own.
pub fn tracked(conn: &Connection) -> Result<Vec<Habit>> {
    Ok(active(conn)?
        .into_iter()
        .filter(|habit| habit.tracking.is_some())
        .collect())
}

/// Writes a measured value; a status the user set keeps its manual source.
fn record_auto(
    conn: &Connection,
    env: &dyn MutationEnv,
    habit_id: &Id,
    date: Date,
    value: f64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO habit_log (id, habit_id, date, value, source) VALUES (?1, ?2, ?3, ?4, 'auto')
         ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value,
           source = CASE WHEN habit_log.status IS NULL THEN 'auto' ELSE habit_log.source END",
        params![
            env.keyed_id(NaturalKey::HabitLog(habit_id, date)),
            habit_id,
            date,
            value
        ],
    )?;
    Ok(())
}

fn sync_window(habit: &Habit, today: Date) -> Vec<Date> {
    let earliest = Date(today.0 - Days::new(SYNC_DAYS));
    let mut date = habit.start_date.max(earliest);
    let mut days = Vec::new();
    while date <= today {
        days.push(date);
        date = Date(date.0 + Days::new(1));
    }
    days
}

fn measure(habit: &Habit, usage: Usage) -> f64 {
    if habit.unit == "times" {
        f64::from(usage.visits)
    } else {
        (usage.seconds / 6.0).round() / 10.0
    }
}

fn project_minutes(conn: &Connection, project_id: &Id, day: Date) -> Result<f64> {
    let from = day.start();
    let to = Date(day.0 + Days::new(1)).start();
    let seconds: i64 = conn.query_row(
        "WITH RECURSIVE tree(id) AS (
           SELECT ?1 UNION ALL SELECT p.id FROM project p JOIN tree ON p.parent_id = tree.id
         )
         SELECT COALESCE(SUM(MIN(ended_at, ?3) - MAX(started_at, ?2)), 0)
         FROM time_entry
         WHERE project_id IN (SELECT id FROM tree) AND ended_at > ?2 AND started_at < ?3",
        params![project_id, from, to],
        |row| row.get(0),
    )?;
    Ok((seconds as f64 / 6.0).round() / 10.0)
}

fn logged_value(conn: &Connection, habit_id: &Id, date: Date) -> Result<Option<f64>> {
    Ok(conn
        .query_row(
            "SELECT value FROM habit_log WHERE habit_id = ?1 AND date = ?2",
            params![habit_id, date],
            |row| row.get(0),
        )
        .optional()?)
}

/// Each project-tracking habit's daily minutes from tracked time, only
/// where they differ from what is logged, for `recordHabitMeasurements`.
pub fn project_measurements(
    conn: &Connection,
    habits: &[Habit],
    today: Date,
) -> Result<Vec<HabitMeasurement>> {
    let mut measurements = Vec::new();
    for habit in habits {
        let Some(project_id) = habit.tracking.as_ref().and_then(|t| t.project_id.as_ref()) else {
            continue;
        };
        for date in sync_window(habit, today) {
            let value = project_minutes(conn, project_id, date)?;
            if logged_value(conn, &habit.id, date)?.unwrap_or(0.0) != value {
                measurements.push(HabitMeasurement {
                    habit_id: habit.id.clone(),
                    date,
                    value,
                });
            }
        }
    }
    Ok(measurements)
}

/// Whether any habit tracks this kind of source (`website` or `app`).
pub fn needs_source(habits: &[Habit], source: &str) -> bool {
    habits
        .iter()
        .any(|h| h.tracking.as_ref().is_some_and(|t| t.source == source))
}

/// The span of ActivityWatch events the habits need, ending tonight.
pub fn activity_span(habits: &[Habit], today: Date) -> (Timestamp, Timestamp) {
    let start = habits
        .iter()
        .flat_map(|habit| sync_window(habit, today).first().copied())
        .min()
        .unwrap_or(today)
        .start();
    let end = Timestamp(Date(today.0 + Days::new(1)).start().0);
    (start, end)
}

/// Website and app habits' daily values measured from fetched events, to
/// record with the `recordHabitMeasurements` mutation.
pub fn measure_activity(
    habits: &[Habit],
    web: &[Event],
    windows: &[Event],
    today: Date,
) -> Vec<HabitMeasurement> {
    let mut measurements = Vec::new();
    for habit in habits {
        let Some(tracking) = &habit.tracking else {
            continue;
        };
        let days = sync_window(habit, today);
        let usage = match tracking.source.as_str() {
            "website" => activity::usage_by_day(
                web,
                |event| activity::matches_website(event, &tracking.patterns),
                &days,
            ),
            "app" => activity::usage_by_day(
                windows,
                |event| activity::matches_app(event, &tracking.patterns),
                &days,
            ),
            _ => continue,
        };
        measurements.extend(days.into_iter().map(|date| HabitMeasurement {
            habit_id: habit.id.clone(),
            date,
            value: measure(habit, usage[&date]),
        }));
    }
    measurements
}

/// Records values a device measured for its tracked habits. A status the
/// user set keeps winning over them.
pub fn record_measurements(
    conn: &Connection,
    env: &dyn MutationEnv,
    measurements: &[HabitMeasurement],
) -> Result<()> {
    for measurement in measurements {
        ensure_loggable(measurement.date, env.today())?;
        if !(measurement.value.is_finite() && measurement.value >= 0.0) {
            return Err(Error::invalid("A measured value can't be negative."));
        }
        if get(conn, &measurement.habit_id)?.tracking.is_none() {
            return Err(Error::invalid("Only tracked habits take measurements."));
        }
        record_auto(
            conn,
            env,
            &measurement.habit_id,
            measurement.date,
            measurement.value,
        )?;
    }
    Ok(())
}
