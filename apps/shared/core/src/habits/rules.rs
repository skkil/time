use rusqlite::Connection;

use super::activity::normalize_domain;
use super::model::{ALL_DAYS, HabitInput, KINDS, MAX_SKIP_DAYS, TIMES_OF_DAY, Tracking, UNITS};
use crate::error::{Error, Result};
use crate::projects;
use crate::types::Date;
use crate::validate::{optional_text, required_text};

pub struct ValidHabit {
    pub name: String,
    pub goal: f64,
    pub unit: String,
    pub area: String,
    pub anchor: String,
    pub tracking: Option<Tracking>,
}

fn validate_tracking(conn: &Connection, tracking: &Tracking) -> Result<Tracking> {
    let patterns: Vec<String> = match tracking.source.as_str() {
        "website" => tracking
            .patterns
            .iter()
            .map(|p| normalize_domain(p))
            .filter(|p| !p.is_empty())
            .collect(),
        "app" => tracking
            .patterns
            .iter()
            .map(|p| p.trim().to_owned())
            .filter(|p| !p.is_empty())
            .collect(),
        "project" => Vec::new(),
        other => return Err(Error::invalid(format!("Unknown tracking source: {other}"))),
    };
    if tracking.source == "project" {
        let project_id = tracking
            .project_id
            .as_ref()
            .ok_or_else(|| Error::invalid("Pick a project to track."))?;
        projects::get(conn, project_id)?;
    } else if patterns.is_empty() {
        return Err(Error::invalid(if tracking.source == "website" {
            "Add at least one website."
        } else {
            "Add at least one app name."
        }));
    }
    Ok(Tracking {
        source: tracking.source.clone(),
        patterns,
        project_id: tracking
            .project_id
            .clone()
            .filter(|_| tracking.source == "project"),
    })
}

pub fn validate(conn: &Connection, input: &HabitInput) -> Result<ValidHabit> {
    let name = required_text(&input.name, "Habit name", 80)?;
    if !KINDS.contains(&input.kind.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown habit type: {}",
            input.kind
        )));
    }
    if !UNITS.contains(&input.unit.as_str()) {
        return Err(Error::invalid(format!("Unknown unit: {}", input.unit)));
    }
    if !TIMES_OF_DAY.contains(&input.time_of_day.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown time of day: {}",
            input.time_of_day
        )));
    }
    if !(1..=ALL_DAYS).contains(&input.days) {
        return Err(Error::invalid("Pick at least one day."));
    }
    let in_range = input.goal.is_finite() && (0.0..=100_000.0).contains(&input.goal);
    let goal = match input.kind.as_str() {
        "quit" => 0.0,
        _ if !in_range => return Err(Error::invalid("That goal is out of range.")),
        "build" if input.goal == 0.0 => {
            return Err(Error::invalid("A goal must be more than zero."));
        }
        _ => input.goal,
    };
    if !(0..=MAX_SKIP_DAYS).contains(&input.skip_days) {
        return Err(Error::invalid("Allow at most two skip days a week."));
    }
    let anchor = optional_text(&input.anchor, "Anchor", 120)?;
    let area = input.area.trim().chars().take(40).collect();
    let tracking = input
        .tracking
        .as_ref()
        .map(|tracking| validate_tracking(conn, tracking))
        .transpose()?;
    let unit = match &tracking {
        Some(tracking) if tracking.source == "project" => "minutes".into(),
        _ => input.unit.clone(),
    };
    Ok(ValidHabit {
        name,
        goal,
        unit,
        area,
        anchor,
        tracking,
    })
}

pub fn ensure_loggable(date: Date, today: Date) -> Result<()> {
    if date > today {
        return Err(Error::invalid("Habits can't be logged ahead of time."));
    }
    Ok(())
}
