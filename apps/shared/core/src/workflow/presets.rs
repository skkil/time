use rusqlite::{Connection, params};

use super::item_types::insert_type;
use super::model::{ItemTypeInput, Preset, StatusInput, ViewInput};
use super::queries::list;
use super::reconcile::reconcile;
use super::rules::{check_milestone_label, check_status, check_type, check_view};
use super::statuses::insert_status;
use super::views::insert_view;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::projects;
use crate::types::Id;
use crate::validate::{optional_text, required_text};

/// Adds a preset's types, statuses and views to a project and gives its
/// existing tasks a status.
pub fn apply_preset(
    conn: &Connection,
    env: &dyn MutationEnv,
    project_id: &Id,
    preset: &Preset,
) -> Result<()> {
    projects::get(conn, project_id)?;
    let types = preset
        .types
        .iter()
        .map(check_type)
        .collect::<Result<Vec<_>>>()?;
    let statuses = preset
        .statuses
        .iter()
        .map(check_status)
        .collect::<Result<Vec<_>>>()?;
    let views = preset
        .views
        .iter()
        .map(check_view)
        .collect::<Result<Vec<_>>>()?;
    let label = check_milestone_label(&preset.milestone_label)?;
    for (position, input) in types.iter().enumerate() {
        insert_type(conn, env, project_id, input, position as i32)?;
    }
    for (position, input) in statuses.iter().enumerate() {
        insert_status(conn, env, project_id, input, position as i32)?;
    }
    for (position, input) in views.iter().enumerate() {
        insert_view(conn, env, project_id, input, position as i32)?;
    }
    conn.execute(
        "UPDATE project SET preset = ?1, milestone_label = ?2 WHERE id = ?3",
        params![optional_text(&preset.key, "Preset", 40)?, label, project_id],
    )?;
    reconcile(conn)
}

/// A project's own setup as a preset that can be saved and applied elsewhere.
pub fn export_preset(conn: &Connection, project_id: &Id) -> Result<Preset> {
    let project = projects::get(conn, project_id)?;
    let workflow = list(conn)?;
    Ok(Preset {
        key: format!("custom-{}", project.name.to_lowercase().replace(' ', "-")),
        name: project.name,
        description: String::new(),
        types: workflow
            .types
            .into_iter()
            .filter(|t| &t.project_id == project_id)
            .map(|t| ItemTypeInput {
                name: t.name,
                icon: t.icon,
                kind: t.kind,
                default_minutes: t.default_minutes,
                checklist: t.checklist,
            })
            .collect(),
        statuses: workflow
            .statuses
            .into_iter()
            .filter(|s| &s.project_id == project_id)
            .map(|s| StatusInput {
                name: s.name,
                category: s.category,
            })
            .collect(),
        milestone_label: project.milestone_label,
        views: workflow
            .views
            .into_iter()
            .filter(|v| &v.project_id == project_id)
            .map(|v| ViewInput {
                name: v.name,
                layout: v.layout,
                group_by: v.group_by,
                filter: v.filter,
                sort: v.sort,
            })
            .collect(),
    })
}

pub fn parse_preset(text: &str) -> Result<Preset> {
    let preset: Preset = serde_json::from_str(text)
        .map_err(|_| Error::invalid("That file isn't a skkil time preset."))?;
    required_text(&preset.name, "Preset name", 60)?;
    for input in &preset.types {
        check_type(input)?;
    }
    for input in &preset.statuses {
        check_status(input)?;
    }
    for input in &preset.views {
        check_view(input)?;
    }
    Ok(preset)
}
