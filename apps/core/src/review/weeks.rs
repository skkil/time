use rusqlite::{Connection, OptionalExtension, params};

use super::days::check_felt;
use super::model::{LAST_STEP, TIMED_TASK_MINUTES, Week, WeekNotes, WeekSummary};
use super::outcomes::outcomes;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::{Date, Seconds};
use crate::validate::optional_text;
use crate::workflow;

pub(super) fn ensure_week(conn: &Connection, env: &dyn MutationEnv, start: Date) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO week (id, start_date) VALUES (?1, ?2)",
        params![env.next_id(), start],
    )?;
    Ok(())
}

/// The week containing `date`, with its reflection and outcomes.
pub fn week(conn: &Connection, date: Date) -> Result<Week> {
    let start = date.monday();
    let row = conn
        .query_row(
            "SELECT felt, step, reviewed_at, worked, fell_short, change
               FROM week WHERE start_date = ?1",
            params![start],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    WeekNotes {
                        worked: row.get(3)?,
                        fell_short: row.get(4)?,
                        change: row.get(5)?,
                    },
                ))
            },
        )
        .optional()?;
    let (felt, step, reviewed_at, notes) = row.unwrap_or((None, 0, None, WeekNotes::default()));
    Ok(Week {
        start_date: start,
        felt,
        step,
        reviewed_at,
        notes,
        outcomes: outcomes(conn, start)?,
    })
}

pub fn week_summary(conn: &Connection, start: Date) -> Result<WeekSummary> {
    let (from, to) = (start.start(), start.add_days(7).start());
    let events = workflow::counted_event_seconds(conn, start, start.add_days(7))?;
    let mut summary = conn.query_row(
        "SELECT w.felt, COALESCE(w.step, 0), w.reviewed_at,
                (SELECT COUNT(*) FROM outcome o WHERE o.week_start = ?1),
                (SELECT COUNT(*) FROM outcome o WHERE o.week_start = ?1 AND o.status = 'achieved'),
                (SELECT COALESCE(SUM(ended_at - started_at), 0) FROM time_entry
                  WHERE started_at >= ?2 AND started_at < ?3),
                (SELECT COALESCE(SUM(end_at - start_at), 0) FROM time_block
                  WHERE start_at >= ?2 AND start_at < ?3)
                + (SELECT COALESCE(SUM(COALESCE(t.estimate_minutes, ?5)), 0) * 60 FROM task t
                    WHERE t.due_date >= ?1 AND t.due_date < ?4 AND t.due_time IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM time_block b WHERE b.task_id = t.id)
                      AND NOT EXISTS (SELECT 1 FROM item_type ty
                                      WHERE ty.id = t.type_id AND ty.kind = 'event')),
                (SELECT COUNT(*) FROM task WHERE completed_at >= ?2 AND completed_at < ?3)
           FROM (SELECT 1) LEFT JOIN week w ON w.start_date = ?1",
        params![start, from, to, start.add_days(7), TIMED_TASK_MINUTES],
        |row| {
            Ok(WeekSummary {
                start_date: start,
                felt: row.get(0)?,
                step: row.get(1)?,
                reviewed_at: row.get(2)?,
                outcomes_total: row.get(3)?,
                outcomes_achieved: row.get(4)?,
                tracked_seconds: row.get(5)?,
                planned_seconds: row.get(6)?,
                tasks_completed: row.get(7)?,
            })
        },
    )?;
    summary.tracked_seconds = Seconds(summary.tracked_seconds.0 + events);
    Ok(summary)
}

/// One summary per week overlapping `from..to`, newest first.
pub fn weeks(conn: &Connection, from: Date, to: Date) -> Result<Vec<WeekSummary>> {
    let mut summaries = Vec::new();
    let mut start = to.add_days(-1).monday();
    while start >= from.monday() {
        summaries.push(week_summary(conn, start)?);
        start = start.add_days(-7);
    }
    Ok(summaries)
}

pub fn save_notes(
    conn: &Connection,
    env: &dyn MutationEnv,
    date: Date,
    notes: &WeekNotes,
) -> Result<()> {
    let text = |value: &str| optional_text(value, "Reflection", 2_000);
    conn.execute(
        "INSERT INTO week (id, start_date, worked, fell_short, change) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(start_date) DO UPDATE SET
           worked = excluded.worked, fell_short = excluded.fell_short, change = excluded.change",
        params![
            env.next_id(),
            date.monday(),
            text(&notes.worked)?,
            text(&notes.fell_short)?,
            text(&notes.change)?
        ],
    )?;
    Ok(())
}

pub fn set_week_felt(conn: &Connection, env: &dyn MutationEnv, date: Date, felt: i32) -> Result<()> {
    check_felt(felt)?;
    let start = date.monday();
    ensure_week(conn, env, start)?;
    conn.execute(
        "UPDATE week SET felt = ?1 WHERE start_date = ?2",
        params![felt, start],
    )?;
    Ok(())
}

pub fn set_week_step(conn: &Connection, env: &dyn MutationEnv, date: Date, step: i32) -> Result<()> {
    if !(0..=LAST_STEP).contains(&step) {
        return Err(Error::invalid("That review step doesn't exist."));
    }
    let start = date.monday();
    ensure_week(conn, env, start)?;
    conn.execute(
        "UPDATE week SET step = MAX(step, ?1) WHERE start_date = ?2",
        params![step, start],
    )?;
    Ok(())
}

pub fn finish_week(conn: &Connection, env: &dyn MutationEnv, date: Date) -> Result<()> {
    let start = date.monday();
    ensure_week(conn, env, start)?;
    conn.execute(
        "UPDATE week SET step = ?1, reviewed_at = COALESCE(reviewed_at, ?2) WHERE start_date = ?3",
        params![LAST_STEP, env.timestamp(), start],
    )?;
    Ok(())
}
