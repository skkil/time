use rusqlite::Connection;

use super::model::{EntryDetails, FUTURE_TOLERANCE_SECONDS, MAX_ENTRY_SECONDS};
use crate::error::{Error, Result};
use crate::types::Timestamp;
use crate::validate::optional_text;
use crate::{projects, tasks};

/// Trims the description and lets a linked task decide the project.
pub fn resolve(conn: &Connection, details: &EntryDetails) -> Result<EntryDetails> {
    let description = optional_text(&details.description, "Description", 500)?;
    let project_id = match &details.task_id {
        Some(task_id) => tasks::get(conn, task_id)?.project_id,
        None => details.project_id.clone(),
    };
    if let Some(project_id) = &project_id {
        projects::get(conn, project_id)?;
    }
    Ok(EntryDetails {
        description,
        project_id,
        task_id: details.task_id.clone(),
    })
}

pub fn validate_span(started_at: Timestamp, ended_at: Timestamp, now: Timestamp) -> Result<()> {
    let length = started_at.seconds_until(ended_at);
    if length < 0 {
        return Err(Error::invalid("An entry must end after it starts."));
    }
    if length > MAX_ENTRY_SECONDS {
        return Err(Error::invalid("An entry can't be longer than 24 hours."));
    }
    if ended_at.0 > now.0 + FUTURE_TOLERANCE_SECONDS {
        return Err(Error::invalid("An entry can't end in the future."));
    }
    Ok(())
}
