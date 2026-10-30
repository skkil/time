use std::collections::HashSet;

use rusqlite::{Connection, params};

use super::model::{
    Moment, PLANNING_SETTING, Ritual, RitualInput, RitualRun, SNOOZE_SECONDS, STEPS, TRIGGERS,
};
use super::queries::{get, latest_run, list, run};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::settings;
use crate::types::{Id, Timestamp};
use crate::validate::ensure_changed;

fn checked_steps(kind: &str, current: Vec<String>, input: &RitualInput) -> Result<Vec<String>> {
    if kind == "weekly" {
        return Ok(current);
    }
    if input.steps.is_empty() {
        return Err(Error::invalid("Keep at least one step."));
    }
    for step in &input.steps {
        if !STEPS.contains(&step.as_str()) {
            return Err(Error::invalid(format!("Unknown step: {step}")));
        }
    }
    let unique: HashSet<_> = input.steps.iter().collect();
    if unique.len() != input.steps.len() {
        return Err(Error::invalid("Each step appears once."));
    }
    Ok(input.steps.clone())
}

pub fn update(conn: &Connection, kind: &str, input: &RitualInput) -> Result<Ritual> {
    let current = get(conn, kind)?;
    if !TRIGGERS.contains(&input.trigger.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown trigger: {}",
            input.trigger
        )));
    }
    if (kind == "session") != (input.trigger == "after_timer_stop") && input.trigger != "manual" {
        return Err(Error::invalid("Only the session ritual follows the timer."));
    }
    if !(0..24 * 60).contains(&input.at_minute) {
        return Err(Error::invalid("Time must be within the day."));
    }
    if !(1..=127).contains(&input.weekdays) {
        return Err(Error::invalid("Pick at least one day."));
    }
    let steps = checked_steps(kind, current.steps, input)?;
    conn.execute(
        "UPDATE ritual SET enabled = ?1, trigger = ?2, at_minute = ?3, weekdays = ?4, steps = ?5
         WHERE kind = ?6",
        params![
            input.enabled,
            input.trigger,
            input.at_minute,
            input.weekdays,
            steps.join(","),
            kind
        ],
    )?;
    get(conn, kind)
}

pub fn planning_time(conn: &Connection) -> Result<Option<String>> {
    settings::read(conn, PLANNING_SETTING)
}

/// Plans in the morning or the evening, turning the other ritual off.
pub fn set_planning_time(
    conn: &Connection,
    env: &dyn MutationEnv,
    time: &str,
) -> Result<Vec<Ritual>> {
    if !matches!(time, "morning" | "evening") {
        return Err(Error::invalid("Plan in the morning or the evening."));
    }
    settings::write(conn, env, PLANNING_SETTING, time)?;
    conn.execute(
        "UPDATE ritual SET enabled = (kind = ?1) WHERE kind IN ('morning', 'evening')",
        params![time],
    )?;
    list(conn)
}

/// Starts a run, or picks up today's unfinished one (sessions always start
/// fresh).
pub fn start(
    conn: &Connection,
    env: &dyn MutationEnv,
    kind: &str,
    task_id: Option<&Id>,
) -> Result<RitualRun> {
    let at = Moment::at(env.now());
    get(conn, kind)?;
    if kind != "session"
        && let Some(previous) = latest_run(conn, kind, at.date)?
        && previous.finished_at.is_none()
    {
        conn.execute(
            "UPDATE ritual_run SET skipped = 0 WHERE id = ?1",
            params![previous.id],
        )?;
        return run(conn, &previous.id);
    }
    let id = env.next_id();
    conn.execute(
        "INSERT INTO ritual_run (id, kind, date, task_id, started_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, kind, at.date, task_id, at.stamp],
    )?;
    run(conn, &id)
}

pub fn reach_step(conn: &Connection, id: &Id, step: i32) -> Result<RitualRun> {
    let rows = conn.execute(
        "UPDATE ritual_run SET step = MAX(step, ?1) WHERE id = ?2",
        params![step.max(0), id],
    )?;
    ensure_changed(rows, "Ritual run")?;
    run(conn, id)
}

pub fn finish(conn: &Connection, env: &dyn MutationEnv, id: &Id) -> Result<RitualRun> {
    let rows = conn.execute(
        "UPDATE ritual_run SET finished_at = COALESCE(finished_at, ?1) WHERE id = ?2",
        params![env.timestamp(), id],
    )?;
    ensure_changed(rows, "Ritual run")?;
    run(conn, id)
}

pub fn skip(conn: &Connection, id: &Id) -> Result<RitualRun> {
    let rows = conn.execute(
        "UPDATE ritual_run SET skipped = 1 WHERE id = ?1 AND finished_at IS NULL",
        params![id],
    )?;
    ensure_changed(rows, "Ritual run")?;
    run(conn, id)
}

/// Snoozes a run for 15 minutes, once.
pub fn snooze(conn: &Connection, env: &dyn MutationEnv, id: &Id) -> Result<RitualRun> {
    let current = run(conn, id)?;
    if current.snoozed_until.is_some() {
        return Err(Error::invalid("This ritual was already snoozed once."));
    }
    conn.execute(
        "UPDATE ritual_run SET snoozed_until = ?1 WHERE id = ?2",
        params![Timestamp(env.timestamp().0 + SNOOZE_SECONDS), id],
    )?;
    run(conn, id)
}
