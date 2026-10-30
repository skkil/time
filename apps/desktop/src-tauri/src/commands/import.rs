use std::fs;

use crate::db::Db;
use serde::Serialize;
use serde_json::json;
use specta::Type;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use time_core::imports::ImportProject;
use time_core::types::Id;
use time_core::{Error, Result};

use super::mutate;

const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportFile {
    pub name: String,
    pub text: String,
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
    mutate(&db, "importProjects", json!({ "projects": projects }))
}
