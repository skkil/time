use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::{CalendarEvent, CalendarSource};
use crate::error::{Error, Result};
use crate::types::{Date, Id};

const SOURCE: &str = "SELECT id, account_id, name, color, visible, position FROM calendar_source";

fn source(row: &Row) -> rusqlite::Result<CalendarSource> {
    Ok(CalendarSource {
        id: row.get(0)?,
        account_id: row.get(1)?,
        name: row.get(2)?,
        color: row.get(3)?,
        visible: row.get(4)?,
        position: row.get(5)?,
    })
}

pub fn sources(conn: &Connection) -> Result<Vec<CalendarSource>> {
    let mut stmt = conn.prepare(&format!("{SOURCE} ORDER BY position, id"))?;
    let rows = stmt.query_map([], source)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn get_source(conn: &Connection, id: &Id) -> Result<CalendarSource> {
    conn.query_row(&format!("{SOURCE} WHERE id = ?1"), params![id], source)
        .optional()?
        .ok_or_else(|| Error::not_found("Calendar"))
}

const EVENT: &str = "SELECT e.id, e.source_id, s.name, s.color, e.title, e.start_at, e.end_at,
       e.all_day, date(e.start_at, 'unixepoch'), date(e.end_at, 'unixepoch'), e.location,
       e.link, e.status = 'tentative'
     FROM calendar_event e JOIN calendar_source s ON s.id = e.source_id
     WHERE s.visible AND e.status <> 'cancelled'";

fn event(row: &Row) -> rusqlite::Result<CalendarEvent> {
    let all_day: bool = row.get(7)?;
    let start_date: Date = row.get(8)?;
    let end_date: Date = row.get(9)?;
    let (start_at, end_at, start_date, end_date) = if all_day {
        (
            start_date.start(),
            end_date.start(),
            Some(start_date),
            Some(end_date),
        )
    } else {
        (row.get(5)?, row.get(6)?, None, None)
    };
    Ok(CalendarEvent {
        id: row.get(0)?,
        source_id: row.get(1)?,
        source_name: row.get(2)?,
        color: row.get(3)?,
        title: row.get(4)?,
        start_at,
        end_at,
        all_day,
        start_date,
        end_date,
        location: row.get(10)?,
        link: row.get(11)?,
        tentative: row.get(12)?,
    })
}

/// Events of visible calendars that overlap `from` up to `to`: timed ones
/// by their span in this device's time zone, all-day ones by their days.
pub fn events(conn: &Connection, from: Date, to: Date) -> Result<Vec<CalendarEvent>> {
    let mut stmt = conn.prepare(&format!(
        "{EVENT} AND CASE WHEN e.all_day
             THEN date(e.start_at, 'unixepoch') < ?4 AND date(e.end_at, 'unixepoch') > ?3
             ELSE e.start_at < ?2 AND e.end_at > ?1 END
         ORDER BY e.all_day DESC, e.start_at, s.position, e.id"
    ))?;
    let rows = stmt.query_map(params![from.start(), to.start(), from, to], event)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
