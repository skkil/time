use rusqlite::{Connection, params};

use super::model::{DEFAULT_EVENT_MINUTES, EventOccurrence, TypeTime};
use super::queries::get_type;
use crate::error::Result;
use crate::recurrence::Recurrence;
use crate::types::{Date, Id, Seconds, Timestamp};

struct EventRow {
    task_id: Id,
    title: String,
    project_id: Option<Id>,
    type_id: Option<Id>,
    due: Date,
    minute: i64,
    length: i64,
    recurrence: Option<String>,
    location: String,
    counts_as_time: bool,
}

/// Every occurrence of an open event between `from` and `to`, repeats
/// expanded, in start order.
pub fn occurrences(conn: &Connection, from: Date, to: Date) -> Result<Vec<EventOccurrence>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title, t.project_id, t.type_id, t.due_date, t.due_time,
                COALESCE(t.estimate_minutes, ty.default_minutes, ?2), t.recurrence,
                t.location, t.counts_as_time
           FROM task t
           JOIN item_type ty ON ty.id = t.type_id AND ty.kind = 'event'
           LEFT JOIN project p ON p.id = t.project_id
          WHERE t.due_date IS NOT NULL AND t.due_time IS NOT NULL AND t.due_date < ?1
            AND t.completed_at IS NULL AND (p.id IS NULL OR p.archived = 0)",
    )?;
    let rows = stmt.query_map(params![to, DEFAULT_EVENT_MINUTES], |row| {
        Ok(EventRow {
            task_id: row.get(0)?,
            title: row.get(1)?,
            project_id: row.get(2)?,
            type_id: row.get(3)?,
            due: row.get(4)?,
            minute: row.get(5)?,
            length: row.get(6)?,
            recurrence: row.get(7)?,
            location: row.get(8)?,
            counts_as_time: row.get(9)?,
        })
    })?;
    let mut result = Vec::new();
    for row in rows {
        let event = row?;
        let repeat = event.recurrence.as_deref().and_then(Recurrence::parse);
        let mut day = event.due;
        while day < to {
            if day >= from {
                let start_at = Timestamp(day.start().0 + event.minute * 60);
                result.push(EventOccurrence {
                    task_id: event.task_id.clone(),
                    title: event.title.clone(),
                    project_id: event.project_id.clone(),
                    type_id: event.type_id.clone(),
                    start_at,
                    end_at: Timestamp(start_at.0 + event.length * 60),
                    location: event.location.clone(),
                    counts_as_time: event.counts_as_time,
                });
            }
            match repeat.as_ref().and_then(|repeat| repeat.following(day.0)) {
                Some(next) => day = Date(next),
                None => break,
            }
        }
    }
    result.sort_by_key(|event| event.start_at.0);
    Ok(result)
}

/// Seconds of past events that count as tracked time.
pub fn counted_event_seconds(conn: &Connection, from: Date, to: Date) -> Result<i64> {
    let now = Timestamp::now();
    Ok(occurrences(conn, from, to)?
        .iter()
        .filter(|event| event.counts_as_time && event.end_at <= now)
        .map(|event| event.end_at.0 - event.start_at.0)
        .sum())
}

/// Tracked time per item type, counted events included, largest first.
pub fn time_by_type(conn: &Connection, from: Date, to: Date) -> Result<Vec<TypeTime>> {
    let mut totals: Vec<TypeTime> = Vec::new();
    let mut add =
        |name: String, icon: String, seconds: i64| match totals.iter_mut().find(|t| t.name == name)
        {
            Some(total) => total.seconds = Seconds(total.seconds.0 + seconds),
            None => totals.push(TypeTime {
                name,
                icon,
                seconds: Seconds(seconds),
            }),
        };
    let mut stmt = conn.prepare(
        "SELECT ty.name, ty.icon, SUM(e.ended_at - e.started_at)
           FROM time_entry e
           JOIN task t ON t.id = e.task_id
           JOIN item_type ty ON ty.id = t.type_id
          WHERE e.started_at >= ?1 AND e.started_at < ?2
          GROUP BY ty.name, ty.icon",
    )?;
    let rows = stmt.query_map(params![from.start(), to.start()], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;
    for row in rows {
        let (name, icon, seconds) = row?;
        add(name, icon, seconds);
    }
    let now = Timestamp::now();
    for event in occurrences(conn, from, to)? {
        if !event.counts_as_time || event.end_at > now {
            continue;
        }
        if let Some(type_id) = &event.type_id {
            let item_type = get_type(conn, type_id)?;
            add(
                item_type.name,
                item_type.icon,
                event.end_at.0 - event.start_at.0,
            );
        }
    }
    totals.sort_by_key(|total| std::cmp::Reverse(total.seconds.0));
    Ok(totals)
}
