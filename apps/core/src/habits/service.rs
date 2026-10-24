use rusqlite::{Connection, params};

use super::model::{Habit, HabitInput, ManualStatus};
use super::queries::get;
use super::rules::{ensure_loggable, validate};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::{Date, Id};
use crate::validate::ensure_changed;

fn write(conn: &Connection, id: &Id, input: &HabitInput, exists: bool) -> Result<()> {
    let valid = validate(conn, input)?;
    let (source, patterns, project_id) = match &valid.tracking {
        Some(t) => (
            Some(t.source.as_str()),
            t.patterns.join("\n"),
            t.project_id.clone(),
        ),
        None => (None, String::new(), None),
    };
    let values = params![
        valid.name,
        input.kind,
        valid.goal,
        valid.unit,
        input.days,
        input.time_of_day,
        valid.area,
        input.start_date,
        source,
        patterns,
        project_id,
        input.skip_days,
        valid.anchor,
        id,
    ];
    if exists {
        let rows = conn.execute(
            "UPDATE habit SET name = ?1, kind = ?2, goal = ?3, unit = ?4, days = ?5,
                              time_of_day = ?6, area = ?7, start_date = ?8, track_source = ?9,
                              track_patterns = ?10, track_project_id = ?11, skip_days = ?12,
                              anchor = ?13
             WHERE id = ?14",
            values,
        )?;
        ensure_changed(rows, "Habit")
    } else {
        conn.execute(
            "INSERT INTO habit (name, kind, goal, unit, days, time_of_day, area, start_date,
                                track_source, track_patterns, track_project_id, skip_days,
                                anchor, id, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                     (SELECT COALESCE(MAX(position), 0) + 1 FROM habit))",
            values,
        )?;
        Ok(())
    }
}

pub fn create(conn: &Connection, env: &dyn MutationEnv, input: &HabitInput) -> Result<Habit> {
    let id = env.next_id();
    write(conn, &id, input, false)?;
    get(conn, &id)
}

/// Saves a habit; changing what it tracks drops the measured values it no
/// longer stands for.
pub fn update(conn: &Connection, id: &Id, input: &HabitInput) -> Result<Habit> {
    let before = get(conn, id)?;
    write(conn, id, input, true)?;
    let tracking_changed = before.tracking != get(conn, id)?.tracking;
    if tracking_changed {
        conn.execute(
            "DELETE FROM habit_log WHERE habit_id = ?1 AND source = 'auto' AND status IS NULL",
            params![id],
        )?;
    }
    get(conn, id)
}

pub fn archive(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("UPDATE habit SET archived = 1 WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Habit")
}

pub fn set_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    habit_id: &Id,
    date: Date,
    status: Option<ManualStatus>,
) -> Result<()> {
    ensure_loggable(date, env.today())?;
    get(conn, habit_id)?;
    conn.execute(
        "INSERT INTO habit_log (id, habit_id, date, status) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(habit_id, date) DO UPDATE SET status = excluded.status",
        params![env.next_id(), habit_id, date, status.map(ManualStatus::as_str)],
    )?;
    Ok(())
}

pub fn add_value(
    conn: &Connection,
    env: &dyn MutationEnv,
    habit_id: &Id,
    date: Date,
    delta: f64,
) -> Result<()> {
    ensure_loggable(date, env.today())?;
    let habit = get(conn, habit_id)?;
    if habit.tracking.is_some() {
        return Err(Error::invalid("This habit is tracked automatically."));
    }
    conn.execute(
        "INSERT INTO habit_log (id, habit_id, date, value) VALUES (?1, ?2, ?3, MAX(0, ?4))
         ON CONFLICT(habit_id, date) DO UPDATE SET value = MAX(0, value + ?4)",
        params![env.next_id(), habit_id, date, delta],
    )?;
    Ok(())
}
