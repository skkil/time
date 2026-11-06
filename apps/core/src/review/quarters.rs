use rusqlite::{Connection, OptionalExtension, params};

use super::model::{MAX_PRIORITIES, Priority, Quarter, WEEKS_PER_QUARTER};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::{Date, Id};
use crate::validate::{ensure_changed, optional_text, required_text};

/// The quarter whose 13 weeks contain `date`, with its priorities.
pub fn quarter_for(conn: &Connection, date: Date) -> Result<Option<Quarter>> {
    let monday = date.monday();
    let found: Option<(Id, String, Date)> = conn
        .query_row(
            "SELECT id, label, start_date FROM quarter
             WHERE start_date <= ?1 ORDER BY start_date DESC LIMIT 1",
            params![monday],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;
    let Some((id, label, start_date)) = found else {
        return Ok(None);
    };
    let week_no = monday.days_since(start_date) / 7 + 1;
    if week_no > WEEKS_PER_QUARTER {
        return Ok(None);
    }

    let mut stmt = conn.prepare(
        "SELECT p.id, p.title, p.note,
                (SELECT COUNT(*) FROM outcome o
                  WHERE o.priority_id = p.id AND o.status = 'achieved'
                    AND o.week_start >= ?2 AND o.week_start < ?3)
           FROM priority p WHERE p.quarter_id = ?1 ORDER BY p.position, p.id",
    )?;
    let priorities = stmt
        .query_map(
            params![id, start_date, start_date.add_days(WEEKS_PER_QUARTER * 7)],
            |row| {
                Ok(Priority {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    note: row.get(2)?,
                    achieved: row.get(3)?,
                })
            },
        )?
        .collect::<rusqlite::Result<_>>()?;

    Ok(Some(Quarter {
        id,
        label,
        start_date,
        week_no: week_no as i32,
        priorities,
    }))
}

pub fn save_quarter(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: Option<&Id>,
    label: &str,
    start: Date,
) -> Result<Id> {
    let label = required_text(label, "Quarter name", 40)?;
    let start = start.monday();
    match id {
        Some(id) => {
            let rows = conn.execute(
                "UPDATE quarter SET label = ?1, start_date = ?2 WHERE id = ?3",
                params![label, start, id],
            )?;
            ensure_changed(rows, "Quarter")?;
            Ok(id.clone())
        }
        None => {
            let id = env.next_id();
            conn.execute(
                "INSERT INTO quarter (id, label, start_date) VALUES (?1, ?2, ?3)",
                params![id, label, start],
            )?;
            Ok(id)
        }
    }
}

pub fn add_priority(
    conn: &Connection,
    env: &dyn MutationEnv,
    quarter_id: &Id,
    title: &str,
) -> Result<()> {
    let title = required_text(title, "Priority", 200)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM priority WHERE quarter_id = ?1",
        params![quarter_id],
        |row| row.get(0),
    )?;
    if count >= MAX_PRIORITIES {
        return Err(Error::invalid("3 priorities max. Remove one first."));
    }
    conn.execute(
        "INSERT INTO priority (id, quarter_id, title, position)
         VALUES (?1, ?2, ?3,
                 (SELECT COALESCE(MAX(position), 0) + 1 FROM priority WHERE quarter_id = ?2))",
        params![env.next_id(), quarter_id, title],
    )?;
    Ok(())
}

pub fn edit_priority(conn: &Connection, id: &Id, title: &str, note: &str) -> Result<()> {
    let title = required_text(title, "Priority", 200)?;
    let note = optional_text(note, "Note", 2_000)?;
    let rows = conn.execute(
        "UPDATE priority SET title = ?1, note = ?2 WHERE id = ?3",
        params![title, note, id],
    )?;
    ensure_changed(rows, "Priority")
}

pub fn delete_priority(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM priority WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Priority")
}
