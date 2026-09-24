use std::fs;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use super::{projects, sections, tasks};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::Id;

const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportFile {
    pub name: String,
    pub text: String,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportTask {
    pub task: tasks::TaskInput,
    pub children: Vec<ImportTask>,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportSection {
    pub name: String,
    pub tasks: Vec<ImportTask>,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportProject {
    pub name: String,
    pub color: String,
    pub tasks: Vec<ImportTask>,
    pub sections: Vec<ImportSection>,
}

fn add_tasks(
    conn: &mut Connection,
    items: &[ImportTask],
    project_id: Id,
    section_id: Option<Id>,
    parent_id: Option<Id>,
) -> Result<()> {
    for item in items {
        let mut input = item.task.clone();
        input.project_id = Some(project_id);
        input.section_id = section_id;
        input.parent_id = parent_id;
        let task = tasks::create(conn, &input).map_err(|error| {
            Error::invalid(format!("Couldn't import “{}”: {error}", input.title))
        })?;
        add_tasks(conn, &item.children, project_id, section_id, Some(task.id))?;
    }
    Ok(())
}

fn add_project(
    conn: &mut Connection,
    project: &ImportProject,
    created: &mut Vec<Id>,
) -> Result<()> {
    let id = projects::create(
        conn,
        &projects::ProjectInput {
            name: project.name.clone(),
            parent_id: None,
            color: project.color.clone(),
        },
    )?
    .id;
    created.push(id);
    add_tasks(conn, &project.tasks, id, None, None)?;
    for section in &project.sections {
        let section_id = sections::create(conn, Some(id), &section.name, None)?.id;
        add_tasks(conn, &section.tasks, id, Some(section_id), None)?;
    }
    Ok(())
}

pub fn import(conn: &mut Connection, projects: &[ImportProject]) -> Result<Vec<Id>> {
    let mut created = Vec::new();
    let outcome = projects
        .iter()
        .try_for_each(|project| add_project(conn, project, &mut created));
    if let Err(error) = outcome {
        for id in &created {
            projects::delete(conn, *id)?;
        }
        return Err(error);
    }
    Ok(created)
}

#[tauri::command]
#[specta::specta]
pub async fn pick_import_files(app: AppHandle) -> Result<Vec<ImportFile>> {
    let picked = app
        .dialog()
        .file()
        .set_title("Import tasks")
        .add_filter("CSV", &["csv"])
        .blocking_pick_files()
        .unwrap_or_default();
    picked
        .into_iter()
        .filter_map(|file| file.into_path().ok())
        .map(|path| {
            let name = path
                .file_stem()
                .map(|stem| stem.to_string_lossy().into_owned())
                .unwrap_or_default();
            let size = fs::metadata(&path)
                .map_err(|_| Error::invalid(format!("Couldn't open {name}.")))?
                .len();
            if size > MAX_FILE_BYTES {
                return Err(Error::invalid(format!("{name} is larger than 5 MB.")));
            }
            let text = fs::read_to_string(&path)
                .map_err(|_| Error::invalid(format!("{name} isn't a text file.")))?;
            Ok(ImportFile {
                name,
                text: text.trim_start_matches('\u{feff}').to_owned(),
            })
        })
        .collect()
}

#[tauri::command]
#[specta::specta]
pub async fn import_projects(db: State<'_, Db>, projects: Vec<ImportProject>) -> Result<Vec<Id>> {
    db.call(move |conn| import(conn, &projects))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(title: &str, children: Vec<ImportTask>) -> ImportTask {
        ImportTask {
            task: tasks::TaskInput {
                title: title.into(),
                notes: String::new(),
                project_id: None,
                section_id: None,
                parent_id: None,
                priority: 4,
                due_date: None,
                due_time: None,
                deadline: None,
                recurrence: None,
                estimate_minutes: None,
            },
            children,
        }
    }

    fn project(name: &str, tasks: Vec<ImportTask>, sections: Vec<ImportSection>) -> ImportProject {
        ImportProject {
            name: name.into(),
            color: "blue".into(),
            tasks,
            sections,
        }
    }

    #[test]
    fn imports_sections_and_nested_tasks() {
        let db = Db::in_memory();
        db.call(|conn| {
            let ids = import(
                conn,
                &[project(
                    "Home",
                    vec![task("Fix sink", vec![task("Buy washer", vec![])])],
                    vec![ImportSection {
                        name: "Garden".into(),
                        tasks: vec![task("Mow", vec![])],
                    }],
                )],
            )?;
            assert_eq!(ids.len(), 1);
            let all = tasks::list(conn)?;
            let washer = all.iter().find(|t| t.title == "Buy washer").unwrap();
            let sink = all.iter().find(|t| t.title == "Fix sink").unwrap();
            assert_eq!(washer.parent_id, Some(sink.id));
            let mow = all.iter().find(|t| t.title == "Mow").unwrap();
            assert!(mow.section_id.is_some());
            assert_eq!(mow.project_id, Some(ids[0]));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn a_bad_row_leaves_nothing_behind() {
        let db = Db::in_memory();
        db.call(|conn| {
            let result = import(
                conn,
                &[
                    project("Good", vec![task("Fine", vec![])], vec![]),
                    project("Bad", vec![task("   ", vec![])], vec![]),
                ],
            );
            assert!(result.is_err());
            assert!(projects::list(conn)?.is_empty());
            assert!(tasks::list(conn)?.is_empty());
            Ok(())
        })
        .unwrap();
    }
}
