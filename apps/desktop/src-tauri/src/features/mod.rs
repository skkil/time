pub mod blocks;
pub mod canvas;
pub mod capture;
pub mod data;
pub mod dependencies;
pub mod groups;
pub mod habits;
pub mod projects;
pub mod records;
pub mod reminders;
pub mod review;
pub mod rituals;
pub mod sections;
pub mod tasks;
pub mod time_entries;
pub mod undo;
pub mod workflow;

use rusqlite::{Connection, OptionalExtension, params};
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};

pub(crate) fn read_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT value FROM setting WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?)
}

pub(crate) fn write_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO setting (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub(crate) fn required_text(value: &str, what: &str, max: usize) -> Result<String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(Error::invalid(format!("{what} can't be empty.")));
    }
    if value.chars().count() > max {
        return Err(Error::invalid(format!(
            "{what} is longer than {max} characters."
        )));
    }
    Ok(value.to_owned())
}

pub(crate) fn optional_text(value: &str, what: &str, max: usize) -> Result<String> {
    let value = value.trim();
    if value.chars().count() > max {
        return Err(Error::invalid(format!(
            "{what} is longer than {max} characters."
        )));
    }
    Ok(value.to_owned())
}

pub(crate) fn ensure_changed(rows: usize, what: &str) -> Result<()> {
    if rows == 0 {
        return Err(Error::not_found(what));
    }
    Ok(())
}

pub(crate) fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
