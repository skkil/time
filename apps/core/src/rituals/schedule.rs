use chrono::Datelike;
use rusqlite::{Connection, OptionalExtension, params};

use super::model::{END_OF_DAY_EARLIEST_BEFORE, Moment, Ritual, RitualEvent};
use super::queries::{latest_run, list};
use crate::error::Result;
use crate::types::{Date, Timestamp};

fn on_weekday(ritual: &Ritual, date: Date) -> bool {
    ritual.weekdays & (1 << date.0.weekday().num_days_from_monday()) != 0
}

fn last_block_end(conn: &Connection, date: Date) -> Result<Option<Timestamp>> {
    Ok(conn.query_row(
        "SELECT MAX(end_at) FROM time_block WHERE start_at >= ?1 AND start_at < ?2",
        params![date.start(), date.add_days(1).start()],
        |row| row.get(0),
    )?)
}

fn last_week_reviewed(conn: &Connection, date: Date) -> Result<bool> {
    let last_monday = date.monday().add_days(-7);
    Ok(conn
        .query_row(
            "SELECT reviewed_at IS NOT NULL FROM week WHERE start_date = ?1",
            params![last_monday],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(false))
}

fn is_due(conn: &Connection, ritual: &Ritual, at: Moment, event: RitualEvent) -> Result<bool> {
    if !ritual.enabled || !on_weekday(ritual, at.date) {
        return Ok(false);
    }
    if ritual.trigger == "after_timer_stop" {
        return Ok(
            matches!(event, RitualEvent::TimerStopped { minutes } if minutes >= ritual.min_minutes),
        );
    }
    if matches!(event, RitualEvent::TimerStopped { .. }) {
        return Ok(false);
    }
    if let Some(previous) = latest_run(conn, &ritual.kind, at.date)? {
        let snooze_over = previous
            .snoozed_until
            .is_some_and(|until| until <= at.stamp);
        return Ok(previous.finished_at.is_none() && !previous.skipped && snooze_over);
    }
    if ritual.kind == "weekly" && last_week_reviewed(conn, at.date)? {
        return Ok(false);
    }
    Ok(match ritual.trigger.as_str() {
        "first_open" => true,
        "at_time" => at.minute >= ritual.at_minute,
        "end_of_day" => {
            at.minute >= ritual.at_minute
                || (at.minute >= ritual.at_minute - END_OF_DAY_EARLIEST_BEFORE
                    && last_block_end(conn, at.date)?.is_some_and(|end| end <= at.stamp))
        }
        _ => false,
    })
}

/// The first ritual that should open for `event` at this moment.
pub fn due(conn: &Connection, at: Moment, event: RitualEvent) -> Result<Option<Ritual>> {
    for ritual in list(conn)? {
        if is_due(conn, &ritual, at, event)? {
            return Ok(Some(ritual));
        }
    }
    Ok(None)
}
