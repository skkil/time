use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::{KINDS, Ritual, RitualRun};
use crate::error::{Error, Result};
use crate::types::{Date, Id};

const SELECT: &str =
    "SELECT kind, enabled, trigger, at_minute, weekdays, min_minutes, steps FROM ritual";
const SELECT_RUN: &str = "SELECT id, kind, date, task_id, started_at, finished_at, skipped, step,
       snoozed_until
     FROM ritual_run";

fn from_row(row: &Row) -> rusqlite::Result<Ritual> {
    let steps: String = row.get(6)?;
    Ok(Ritual {
        kind: row.get(0)?,
        enabled: row.get(1)?,
        trigger: row.get(2)?,
        at_minute: row.get(3)?,
        weekdays: row.get(4)?,
        min_minutes: row.get(5)?,
        steps: steps
            .split(',')
            .filter(|step| !step.is_empty())
            .map(str::to_owned)
            .collect(),
    })
}

fn run_from_row(row: &Row) -> rusqlite::Result<RitualRun> {
    Ok(RitualRun {
        id: row.get(0)?,
        kind: row.get(1)?,
        date: row.get(2)?,
        task_id: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        skipped: row.get(6)?,
        step: row.get(7)?,
        snoozed_until: row.get(8)?,
    })
}

pub fn get(conn: &Connection, kind: &str) -> Result<Ritual> {
    conn.query_row(
        &format!("{SELECT} WHERE kind = ?1"),
        params![kind],
        from_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Ritual"))
}

pub fn list(conn: &Connection) -> Result<Vec<Ritual>> {
    KINDS.iter().map(|kind| get(conn, kind)).collect()
}

pub fn run(conn: &Connection, id: &Id) -> Result<RitualRun> {
    conn.query_row(
        &format!("{SELECT_RUN} WHERE id = ?1"),
        params![id],
        run_from_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Ritual run"))
}

pub fn latest_run(conn: &Connection, kind: &str, date: Date) -> Result<Option<RitualRun>> {
    Ok(conn
        .query_row(
            &format!("{SELECT_RUN} WHERE kind = ?1 AND date = ?2 ORDER BY started_at DESC, id DESC LIMIT 1"),
            params![kind, date],
            run_from_row,
        )
        .optional()?)
}

pub fn runs(conn: &Connection, from: Date, to: Date) -> Result<Vec<RitualRun>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT_RUN} WHERE date >= ?1 AND date < ?2 ORDER BY started_at, id"
    ))?;
    let rows = stmt.query_map(params![from, to], run_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
