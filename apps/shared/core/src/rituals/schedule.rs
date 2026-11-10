use chrono::Datelike;
use rusqlite::{Connection, OptionalExtension, params};

use super::model::{
    DEFAULT_REVIEW_DAY, DueRitual, END_OF_DAY_EARLIEST_BEFORE, Moment, REVIEW_DAY_SETTING, Ritual,
    RitualEvent,
};
use super::queries::{get, latest_run, list};
use crate::error::Result;
use crate::settings;
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

fn week_reviewed(conn: &Connection, monday: Date) -> Result<bool> {
    Ok(conn
        .query_row(
            "SELECT reviewed_at IS NOT NULL FROM week WHERE start_date = ?1",
            params![monday],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(false))
}

pub fn review_day(conn: &Connection) -> Result<i32> {
    Ok(settings::read(conn, REVIEW_DAY_SETTING)?
        .and_then(|value| value.parse().ok())
        .filter(|day| (0..7).contains(day))
        .unwrap_or(DEFAULT_REVIEW_DAY))
}

/// The Monday of the week the `kind` ritual goes on to close now: the
/// evening on the review day, or the morning after it, once.
pub fn week_to_close(conn: &Connection, at: Moment, kind: &str) -> Result<Option<Date>> {
    let closing = match kind {
        "evening" => at.date,
        "morning" => at.date.add_days(-1),
        _ => return Ok(None),
    };
    if closing.0.weekday().num_days_from_monday() as i32 != review_day(conn)? {
        return Ok(None);
    }
    let week = closing.monday();
    if week_reviewed(conn, week)? {
        return Ok(None);
    }
    let answered =
        latest_run(conn, "weekly", at.date)?.is_some_and(|run| run.skipped || kind == "morning");
    Ok((!answered).then_some(week))
}

fn snoozed_week(conn: &Connection, at: Moment) -> Result<Option<DueRitual>> {
    let Some(run) = latest_run(conn, "weekly", at.date)? else {
        return Ok(None);
    };
    if run.finished_at.is_some()
        || run.skipped
        || !run.snoozed_until.is_some_and(|until| until <= at.stamp)
    {
        return Ok(None);
    }
    for host in ["evening", "morning"] {
        if let Some(week) = week_to_close(conn, at, host)? {
            return Ok(Some(DueRitual {
                ritual: get(conn, "weekly")?,
                week: Some(week),
            }));
        }
    }
    Ok(None)
}

fn is_due(conn: &Connection, ritual: &Ritual, at: Moment, event: RitualEvent) -> Result<bool> {
    if !ritual.enabled || ritual.trigger == "manual" || !on_weekday(ritual, at.date) {
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
    if ritual.kind == "weekly" && week_reviewed(conn, at.date.monday().add_days(-7))? {
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

/// The first ritual that should open for `event` at this moment: a snoozed
/// weekly checkout first, then each ritual in order.
pub fn due(conn: &Connection, at: Moment, event: RitualEvent) -> Result<Option<DueRitual>> {
    if !matches!(event, RitualEvent::TimerStopped { .. })
        && let Some(due) = snoozed_week(conn, at)?
    {
        return Ok(Some(due));
    }
    for ritual in list(conn)? {
        if is_due(conn, &ritual, at, event)? {
            let week = week_to_close(conn, at, &ritual.kind)?;
            return Ok(Some(DueRitual { ritual, week }));
        }
    }
    Ok(None)
}
