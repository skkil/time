use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use super::{read_setting, show_main_window, write_setting};
use crate::db::Db;
use crate::error::{Error, Result};

const ENABLED_SETTING: &str = "capture_hotkey";
const QUICK_ADD_EVENT: &str = "quick-add";
const QUICK_ADD_FLAG: &str = "--quick-add";

#[cfg(target_os = "macos")]
const MODIFIERS: Modifiers = Modifiers::SUPER.union(Modifiers::ALT);
#[cfg(not(target_os = "macos"))]
const MODIFIERS: Modifiers = Modifiers::CONTROL.union(Modifiers::ALT);

fn shortcut() -> Shortcut {
    Shortcut::new(Some(MODIFIERS), Code::KeyN)
}

pub fn enabled(conn: &Connection) -> Result<bool> {
    Ok(read_setting(conn, ENABLED_SETTING)?.as_deref() != Some("off"))
}

fn set_enabled(conn: &Connection, enabled: bool) -> Result<()> {
    write_setting(conn, ENABLED_SETTING, if enabled { "on" } else { "off" })
}

fn quick_add(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit(QUICK_ADD_EVENT, ());
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                quick_add(app);
            }
        })
        .build()
}

pub fn single_instance() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_single_instance::init(|app, args, _cwd| {
        if args.iter().any(|arg| arg == QUICK_ADD_FLAG) {
            quick_add(app);
        } else {
            show_main_window(app);
        }
    })
}

fn apply(app: &AppHandle, enabled: bool) -> Result<()> {
    let shortcuts = app.global_shortcut();
    let registered = shortcuts.is_registered(shortcut());
    let outcome = match (enabled, registered) {
        (true, false) => shortcuts.register(shortcut()),
        (false, true) => shortcuts.unregister(shortcut()),
        _ => Ok(()),
    };
    outcome.map_err(|_| {
        Error::invalid(
            "This system doesn't let apps use a shortcut while they are in the background.",
        )
    })
}

pub fn start(app: &AppHandle) {
    let db = app.state::<Db>();
    if db.call(|conn| enabled(conn)).unwrap_or(true) {
        let _ = apply(app, true);
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_capture_hotkey(db: State<'_, Db>) -> Result<bool> {
    db.call(|conn| enabled(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_capture_hotkey(app: AppHandle, db: State<'_, Db>, enabled: bool) -> Result<()> {
    apply(&app, enabled)?;
    db.call(move |conn| set_enabled(conn, enabled))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hotkey_is_on_until_turned_off() {
        let db = Db::in_memory();
        db.call(|conn| {
            assert!(enabled(conn)?);
            set_enabled(conn, false)?;
            assert!(!enabled(conn)?);
            set_enabled(conn, true)?;
            assert!(enabled(conn)?);
            Ok(())
        })
        .unwrap();
    }
}
