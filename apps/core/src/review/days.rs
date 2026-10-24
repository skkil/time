use rusqlite::{Connection, params};

use super::model::Day;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::Date;
use crate::validate::optional_text;

pub(super) fn check_felt(felt: i32) -> Result<()> {
    if !(1..=5).contains(&felt) {
        return Err(Error::invalid("Rate it from 1 to 5."));
    }
    Ok(())
}

fn check_past(date: Date, today: Date) -> Result<()> {
    if date > today {
        return Err(Error::invalid("That day hasn't happened yet."));
    }
    Ok(())
}

pub fn days(conn: &Connection, from: Date, to: Date) -> Result<Vec<Day>> {
    let mut stmt = conn.prepare(
        "SELECT date, felt, reflection, skipped FROM day
         WHERE date >= ?1 AND date < ?2 ORDER BY date",
    )?;
    let rows = stmt.query_map(params![from, to], |row| {
        Ok(Day {
            date: row.get(0)?,
            felt: row.get(1)?,
            note: row.get(2)?,
            skipped: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn set_day_felt(conn: &Connection, env: &dyn MutationEnv, date: Date, felt: i32) -> Result<()> {
    check_felt(felt)?;
    check_past(date, env.today())?;
    conn.execute(
        "INSERT INTO day (id, date, felt) VALUES (?1, ?2, ?3)
         ON CONFLICT(date) DO UPDATE SET felt = excluded.felt, skipped = 0",
        params![env.next_id(), date, felt],
    )?;
    Ok(())
}

pub fn set_day_note(
    conn: &Connection,
    env: &dyn MutationEnv,
    date: Date,
    note: &str,
) -> Result<()> {
    check_past(date, env.today())?;
    let note = optional_text(note, "Note", 280)?;
    conn.execute(
        "INSERT INTO day (id, date, reflection) VALUES (?1, ?2, ?3)
         ON CONFLICT(date) DO UPDATE SET reflection = excluded.reflection",
        params![env.next_id(), date, note],
    )?;
    Ok(())
}

pub fn skip_day(conn: &Connection, env: &dyn MutationEnv, date: Date) -> Result<()> {
    conn.execute(
        "INSERT INTO day (id, date, skipped) VALUES (?1, ?2, 1)
         ON CONFLICT(date) DO UPDATE SET skipped = 1",
        params![env.next_id(), date],
    )?;
    Ok(())
}
