use rusqlite::Connection;

use super::model::{COLORS, MAX_DEPTH, ProjectInput, ProjectSettings, REVIEW_WEEKS, STATUSES};
use super::queries::{depth, get, subtree};
use crate::error::{Error, Result};
use crate::groups;
use crate::types::Id;
use crate::validate::{optional_text, required_text};

/// Checks a project's name, colour and place, returning the trimmed name.
/// `moving` is the project being re-parented, whose subtree must still fit.
pub fn validate(conn: &Connection, input: &ProjectInput, moving: Option<&Id>) -> Result<String> {
    let name = required_text(&input.name, "Project name", 120)?;
    if !COLORS.contains(&input.color.as_str()) {
        return Err(Error::invalid(format!("Unknown color: {}", input.color)));
    }
    let Some(parent_id) = &input.parent_id else {
        return Ok(name);
    };

    let parent = get(conn, parent_id)?;
    if parent.archived {
        return Err(Error::invalid("Can't add to an archived project."));
    }

    let height = match moving {
        Some(id) => {
            let descendants = subtree(conn, id)?;
            if descendants
                .iter()
                .any(|(descendant, _)| descendant == parent_id)
            {
                return Err(Error::invalid("A project can't move inside itself."));
            }
            descendants
                .iter()
                .map(|(_, depth)| *depth)
                .max()
                .unwrap_or(1)
        }
        None => 1,
    };
    if depth(conn, parent_id)? + height > MAX_DEPTH {
        return Err(Error::invalid(format!(
            "Projects nest at most {MAX_DEPTH} levels deep."
        )));
    }
    Ok(name)
}

pub struct ValidSettings {
    pub outcome: String,
    pub kill_criteria: String,
}

pub fn validate_settings(
    conn: &Connection,
    parent_id: Option<&Id>,
    settings: &ProjectSettings,
) -> Result<ValidSettings> {
    if !STATUSES.contains(&settings.status.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown status: {}",
            settings.status
        )));
    }
    if !REVIEW_WEEKS.contains(&settings.review_every_weeks) {
        return Err(Error::invalid("Review every 1, 2 or 4 weeks."));
    }
    if let Some(minutes) = settings.weekly_minutes
        && !(1..=7 * 24 * 60).contains(&minutes)
    {
        return Err(Error::invalid("Weekly time must be within a week."));
    }
    if settings.group_id.is_some() && parent_id.is_some() {
        return Err(Error::invalid(
            "Sub-projects follow the group of the project they sit in.",
        ));
    }
    if let Some(group_id) = &settings.group_id {
        groups::get(conn, group_id)?;
    }
    Ok(ValidSettings {
        outcome: optional_text(&settings.outcome, "Outcome", 300)?,
        kill_criteria: optional_text(&settings.kill_criteria, "Stop rule", 300)?,
    })
}
