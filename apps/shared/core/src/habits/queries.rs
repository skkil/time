use std::collections::HashMap;

use chrono::Days;
use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::{Habit, HabitDay, Log, Tracking};
use super::status::{status, with_stats};
use crate::error::{Error, Result};
use crate::types::{Date, Id};

const SELECT: &str = "SELECT id, name, kind, goal, unit, days, time_of_day, area, start_date,
       track_source, track_patterns, track_project_id, skip_days, anchor
     FROM habit";

fn from_row(row: &Row) -> rusqlite::Result<Habit> {
    let source: Option<String> = row.get(9)?;
    let patterns: String = row.get(10)?;
    Ok(Habit {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        goal: row.get(3)?,
        unit: row.get(4)?,
        days: row.get(5)?,
        time_of_day: row.get(6)?,
        area: row.get(7)?,
        start_date: row.get(8)?,
        tracking: source.map(|source| Tracking {
            source,
            patterns: patterns
                .split('\n')
                .filter(|p| !p.is_empty())
                .map(str::to_owned)
                .collect(),
            project_id: row.get(11).ok().flatten(),
        }),
        skip_days: row.get(12)?,
        anchor: row.get(13)?,
        done_days: 0,
        due_days: 0,
        clean_since: None,
    })
}

fn logs_for(conn: &Connection, habit_id: &Id) -> Result<HashMap<Date, Log>> {
    let mut stmt = conn.prepare("SELECT date, status, value FROM habit_log WHERE habit_id = ?1")?;
    let rows = stmt.query_map(params![habit_id], |row| {
        Ok((
            row.get::<_, Date>(0)?,
            Log {
                status: row.get(1)?,
                value: row.get(2)?,
            },
        ))
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn stats(conn: &Connection, habit: Habit, today: Date) -> Result<Habit> {
    let logs = logs_for(conn, &habit.id)?;
    Ok(with_stats(habit, &logs, today))
}

pub fn get(conn: &Connection, id: &Id) -> Result<Habit> {
    let habit = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Habit"))?;
    stats(conn, habit, Date::today())
}

/// Habits that are not archived, without their stats.
pub fn active(conn: &Connection) -> Result<Vec<Habit>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT} WHERE archived = 0 ORDER BY position, id"
    ))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn list(conn: &Connection) -> Result<Vec<Habit>> {
    let today = Date::today();
    active(conn)?
        .into_iter()
        .map(|habit| stats(conn, habit, today))
        .collect()
}

/// Every active habit's status on each day of `from..to`.
pub fn days(conn: &Connection, from: Date, to: Date) -> Result<Vec<HabitDay>> {
    let today = Date::today();
    let mut logs: HashMap<(Id, Date), (Log, bool)> = HashMap::new();
    let mut stmt = conn.prepare(
        "SELECT habit_id, date, status, value, source FROM habit_log WHERE date >= ?1 AND date < ?2",
    )?;
    let rows = stmt.query_map(params![from, to], |row| {
        Ok((
            (row.get::<_, Id>(0)?, row.get::<_, Date>(1)?),
            (
                Log {
                    status: row.get(2)?,
                    value: row.get(3)?,
                },
                row.get::<_, String>(4)? == "manual",
            ),
        ))
    })?;
    for row in rows {
        let (key, value) = row?;
        logs.insert(key, value);
    }

    let mut result = Vec::new();
    for habit in active(conn)? {
        let mut date = from;
        while date < to {
            let entry = logs.get(&(habit.id.clone(), date));
            let log = entry.map(|(log, _)| log);
            result.push(HabitDay {
                habit_id: habit.id.clone(),
                date,
                status: status(&habit, date, today, log),
                value: log.map_or(0.0, |log| log.value),
                manual: entry.is_some_and(|(log, manual)| *manual || log.status.is_some()),
            });
            date = Date(date.0 + Days::new(1));
        }
    }
    Ok(result)
}
