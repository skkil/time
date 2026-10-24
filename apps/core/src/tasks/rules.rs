use rusqlite::Connection;

use super::model::{MAX_ESTIMATE_MINUTES, TaskInput};
use super::placement::{Container, resolve_container};
use crate::error::{Error, Result};
use crate::recurrence::Recurrence;
use crate::types::{Date, Id};
use crate::validate::{optional_text, required_text};

pub struct ValidTask {
    pub title: String,
    pub notes: String,
    pub container: Container,
    pub recurrence: Option<String>,
}

pub fn validate(conn: &Connection, moving: Option<&Id>, input: &TaskInput) -> Result<ValidTask> {
    let title = required_text(&input.title, "Task title", 500)?;
    let notes = optional_text(&input.notes, "Description", 10_000)?;
    if !(1..=4).contains(&input.priority) {
        return Err(Error::invalid("Priority must be between 1 and 4."));
    }
    if let Some(minutes) = input.estimate_minutes
        && !(1..=MAX_ESTIMATE_MINUTES).contains(&minutes)
    {
        return Err(Error::invalid(
            "Duration must be between 1 minute and 24 hours.",
        ));
    }
    if let Some(time) = input.due_time {
        if input.due_date.is_none() {
            return Err(Error::invalid("A time needs a date."));
        }
        if !(0..24 * 60).contains(&time) {
            return Err(Error::invalid("Time must be within the day."));
        }
    }
    let recurrence = match input.recurrence.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(text) => {
            let repeat = Recurrence::parse(text)
                .ok_or_else(|| Error::invalid(format!("Can't repeat “{text}”.")))?;
            if input.due_date.is_none() {
                return Err(Error::invalid("Repeating tasks need a date."));
            }
            Some(repeat.to_string())
        }
    };
    let container = resolve_container(
        conn,
        moving,
        input.project_id.as_ref(),
        input.section_id.as_ref(),
        input.parent_id.as_ref(),
    )?;
    Ok(ValidTask {
        title,
        notes,
        container,
        recurrence,
    })
}

/// A new repeating task starts on its first matching day on or after its
/// date (or `today`).
pub fn on_first_occurrence(input: &TaskInput, today: Date) -> TaskInput {
    let mut input = input.clone();
    if let Some(repeat) = input.recurrence.as_deref().and_then(Recurrence::parse) {
        let first = repeat.first_date(input.due_date.map(|date| date.0), today.0);
        input.due_date = Some(Date(first));
    }
    input
}
