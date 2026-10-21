use rusqlite::Connection;

use super::model::{ImportProject, ImportTask};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::projects::{self, ProjectInput};
use crate::types::Id;
use crate::{sections, tasks};

struct Place<'a> {
    project_id: &'a Id,
    section_id: Option<&'a Id>,
    parent_id: Option<&'a Id>,
}

fn add_tasks(
    conn: &Connection,
    env: &dyn MutationEnv,
    items: &[ImportTask],
    place: &Place,
) -> Result<()> {
    for item in items {
        let mut input = item.task.clone();
        input.project_id = Some(place.project_id.clone());
        input.section_id = place.section_id.cloned();
        input.parent_id = place.parent_id.cloned();
        let task = tasks::create(conn, env, &input).map_err(|error| {
            Error::invalid(format!("Couldn't import “{}”: {error}", input.title))
        })?;
        let inside = Place {
            parent_id: Some(&task.id),
            ..*place
        };
        add_tasks(conn, env, &item.children, &inside)?;
    }
    Ok(())
}

fn add_project(
    conn: &Connection,
    env: &dyn MutationEnv,
    project: &ImportProject,
    created: &mut Vec<Id>,
) -> Result<()> {
    let input = ProjectInput {
        name: project.name.clone(),
        parent_id: None,
        color: project.color.clone(),
    };
    let id = projects::create(conn, env, &input)?.id;
    created.push(id.clone());
    let top = Place {
        project_id: &id,
        section_id: None,
        parent_id: None,
    };
    add_tasks(conn, env, &project.tasks, &top)?;
    for section in &project.sections {
        let section_id = sections::create(conn, env, Some(&id), &section.name, None)?.id;
        let inside = Place {
            section_id: Some(&section_id),
            ..top
        };
        add_tasks(conn, env, &section.tasks, &inside)?;
    }
    Ok(())
}

/// Creates one project per parsed file. If any row fails, the projects made
/// so far are removed again.
pub fn import(
    conn: &Connection,
    env: &dyn MutationEnv,
    projects: &[ImportProject],
) -> Result<Vec<Id>> {
    let mut created = Vec::new();
    let outcome = projects
        .iter()
        .try_for_each(|project| add_project(conn, env, project, &mut created));
    if let Err(error) = outcome {
        for id in &created {
            projects::delete(conn, id)?;
        }
        return Err(error);
    }
    Ok(created)
}
