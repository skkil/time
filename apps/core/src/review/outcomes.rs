use rusqlite::{Connection, OptionalExtension, params};

use super::model::{MAX_CARRIES, MAX_OPEN_OUTCOMES, Outcome, OutcomeStatus};
use super::weeks::ensure_week;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::{Date, Id};
use crate::validate::{ensure_changed, required_text};

pub(super) fn outcomes(conn: &Connection, start: Date) -> Result<Vec<Outcome>> {
    let mut stmt = conn.prepare(
        "SELECT o.id, o.title, o.status, o.priority_id, o.carried_from,
                (SELECT COUNT(*) FROM task t WHERE t.outcome_id = o.id),
                (SELECT COUNT(*) FROM task t WHERE t.outcome_id = o.id AND t.completed_at IS NOT NULL),
                (SELECT COALESCE(SUM(e.ended_at - e.started_at), 0)
                   FROM time_entry e JOIN task t ON t.id = e.task_id
                  WHERE t.outcome_id = o.id AND e.started_at >= ?2 AND e.started_at < ?3)
           FROM outcome o WHERE o.week_start = ?1 ORDER BY o.created_at, o.id",
    )?;
    let rows = stmt.query_map(
        params![start, start.start(), start.add_days(7).start()],
        |row| {
            Ok(Outcome {
                id: row.get(0)?,
                title: row.get(1)?,
                status: OutcomeStatus::parse(&row.get::<_, String>(2)?)?,
                priority_id: row.get(3)?,
                carried_from: row.get(4)?,
                times_carried: 0,
                tasks_total: row.get(5)?,
                tasks_done: row.get(6)?,
                tracked_seconds: row.get(7)?,
            })
        },
    )?;
    let mut outcomes = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    for outcome in &mut outcomes {
        outcome.times_carried = times_carried(conn, &outcome.id)?;
    }
    Ok(outcomes)
}

fn times_carried(conn: &Connection, id: &Id) -> Result<i32> {
    Ok(conn.query_row(
        "WITH RECURSIVE chain(id, previous) AS (
           SELECT id, carried_from FROM outcome WHERE id = ?1
           UNION ALL
           SELECT o.id, o.carried_from FROM outcome o JOIN chain ON o.id = chain.previous
         )
         SELECT COUNT(*) - 1 FROM chain",
        params![id],
        |row| row.get(0),
    )?)
}

fn open_outcomes(conn: &Connection, start: Date, except: Option<&Id>) -> Result<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM outcome
         WHERE week_start = ?1 AND status = 'open' AND id IS NOT ?2",
        params![start, except],
        |row| row.get(0),
    )?)
}

fn too_many() -> Error {
    Error::invalid("3 outcomes max. Finish or drop one first.")
}

fn insert_outcome(
    conn: &Connection,
    env: &dyn MutationEnv,
    start: Date,
    title: &str,
    priority_id: Option<&Id>,
    carried_from: Option<&Id>,
) -> Result<Id> {
    if open_outcomes(conn, start, None)? >= MAX_OPEN_OUTCOMES {
        return Err(too_many());
    }
    ensure_week(conn, start)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO outcome (id, week_start, title, priority_id, carried_from, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, start, title, priority_id, carried_from, env.timestamp()],
    )?;
    Ok(id)
}

pub fn add_outcome(
    conn: &Connection,
    env: &dyn MutationEnv,
    date: Date,
    title: &str,
    priority_id: Option<&Id>,
) -> Result<()> {
    let title = required_text(title, "Outcome", 200)?;
    insert_outcome(conn, env, date.monday(), &title, priority_id, None)?;
    Ok(())
}

pub fn rename_outcome(
    conn: &Connection,
    id: &Id,
    title: &str,
    priority_id: Option<&Id>,
) -> Result<()> {
    let title = required_text(title, "Outcome", 200)?;
    let rows = conn.execute(
        "UPDATE outcome SET title = ?1, priority_id = ?2 WHERE id = ?3",
        params![title, priority_id, id],
    )?;
    ensure_changed(rows, "Outcome")
}

/// Copies the outcome into next week and moves its open tasks along.
fn carry(conn: &Connection, env: &dyn MutationEnv, id: &Id, start: Date) -> Result<()> {
    let (title, priority_id): (String, Option<Id>) = conn.query_row(
        "SELECT title, priority_id FROM outcome WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let next = insert_outcome(
        conn,
        env,
        start.add_days(7),
        &title,
        priority_id.as_ref(),
        Some(id),
    )?;
    conn.execute(
        "UPDATE task SET outcome_id = ?1 WHERE outcome_id = ?2 AND completed_at IS NULL",
        params![next, id],
    )?;
    Ok(())
}

fn uncarry(conn: &Connection, id: &Id) -> Result<()> {
    let next: Option<Id> = conn
        .query_row(
            "SELECT id FROM outcome WHERE carried_from = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(next) = next {
        conn.execute(
            "UPDATE task SET outcome_id = ?1 WHERE outcome_id = ?2",
            params![id, next],
        )?;
        conn.execute("DELETE FROM outcome WHERE id = ?1", params![next])?;
    }
    Ok(())
}

pub fn set_outcome_status(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    status: OutcomeStatus,
) -> Result<()> {
    let (start, current): (Date, String) = conn
        .query_row(
            "SELECT week_start, status FROM outcome WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| Error::not_found("Outcome"))?;
    let current = OutcomeStatus::parse(&current)?;
    if current == status {
        return Ok(());
    }
    if status == OutcomeStatus::Open && open_outcomes(conn, start, Some(id))? >= MAX_OPEN_OUTCOMES {
        return Err(too_many());
    }
    if current == OutcomeStatus::Carried {
        uncarry(conn, id)?;
    }
    if status == OutcomeStatus::Carried {
        if times_carried(conn, id)? >= MAX_CARRIES {
            return Err(Error::invalid(
                "Carried twice already. Shrink it, give it a new date, or drop it.",
            ));
        }
        carry(conn, env, id, start)?;
    }
    conn.execute(
        "UPDATE outcome SET status = ?1 WHERE id = ?2",
        params![status.as_str(), id],
    )?;
    Ok(())
}

pub fn delete_outcome(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM outcome WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Outcome")
}
