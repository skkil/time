use rusqlite::{Connection, params};

use super::model::{BlockSpan, MAX_BLOCK_SECONDS, MINUTE, TimeBlock};
use super::queries::get;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::tasks;
use crate::types::{Id, Timestamp};
use crate::validate::ensure_changed;

fn validate(span: &BlockSpan) -> Result<()> {
    if span.start_at.0 % MINUTE != 0 || span.end_at.0 % MINUTE != 0 {
        return Err(Error::invalid("Blocks start and end on whole minutes."));
    }
    let length = span.start_at.seconds_until(span.end_at);
    if length <= 0 {
        return Err(Error::invalid("A block must end after it starts."));
    }
    if length > MAX_BLOCK_SECONDS {
        return Err(Error::invalid("A block can't be longer than 24 hours."));
    }
    Ok(())
}

pub fn create(
    conn: &Connection,
    env: &dyn MutationEnv,
    task_id: &Id,
    span: &BlockSpan,
) -> Result<TimeBlock> {
    validate(span)?;
    tasks::get(conn, task_id)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO time_block (id, task_id, start_at, end_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, task_id, span.start_at, span.end_at],
    )?;
    get(conn, &id)
}

/// Moves a block. When it lands on another day, its open, one-off, dated task
/// moves to that day too.
pub fn reschedule(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    span: &BlockSpan,
) -> Result<TimeBlock> {
    validate(span)?;
    let before = get(conn, id)?;
    conn.execute(
        "UPDATE time_block SET start_at = ?1, end_at = ?2 WHERE id = ?3",
        params![span.start_at, span.end_at, id],
    )?;
    let day = env.date_of(span.start_at);
    if env.date_of(before.start_at) != day {
        conn.execute(
            "UPDATE task SET due_date = ?1
             WHERE id = ?2 AND completed_at IS NULL AND recurrence IS NULL
               AND due_date IS NOT NULL AND due_until IS NULL",
            params![day, before.task_id],
        )?;
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM time_block WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Time block")
}

pub fn shift_upcoming(conn: &Connection, task_id: &Id, from: Timestamp, days: i64) -> Result<i32> {
    let seconds = days * Timestamp::DAY;
    let rows = conn.execute(
        "UPDATE time_block SET start_at = start_at + ?1, end_at = end_at + ?1
         WHERE task_id = ?2 AND start_at >= ?3",
        params![seconds, task_id, from],
    )?;
    Ok(rows as i32)
}

pub fn remove_upcoming(conn: &Connection, task_id: &Id, from: Timestamp) -> Result<i32> {
    let rows = conn.execute(
        "DELETE FROM time_block WHERE task_id = ?1 AND start_at >= ?2",
        params![task_id, from],
    )?;
    Ok(rows as i32)
}
