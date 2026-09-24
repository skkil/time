use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, Ordering};

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use super::time_entries::Timer;
use super::undo::UndoLog;
use crate::db::{self, Db};
use crate::error::{Error, Result};
use crate::types::Date;

const BACKUP_FILTER: &str = "skkil time backup";
const BACKUP_EXTENSION: &str = "db";
const SAFETY_COPY: &str = "time-before-restore.db";
const STAGED_RESTORE: &str = "time-restoring.db";

fn io_error(error: std::io::Error) -> Error {
    Error::invalid(format!("Couldn't use that file: {error}"))
}

fn remove_if_present(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(io_error(error)),
        _ => Ok(()),
    }
}

fn remove_staged(path: &Path) -> Result<()> {
    remove_if_present(path)?;
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = path.as_os_str().to_owned();
        sidecar.push(suffix);
        remove_if_present(Path::new(&sidecar))?;
    }
    Ok(())
}

pub fn export_to(conn: &Connection, path: &Path) -> Result<()> {
    let staged = path.with_extension("exporting");
    remove_if_present(&staged)?;
    conn.execute("VACUUM INTO ?1", [staged.to_string_lossy()])?;
    fs::rename(&staged, path).map_err(io_error)
}

fn stage_backup(file: &Path, staged: &Path) -> Result<Connection> {
    remove_staged(staged)?;
    fs::copy(file, staged).map_err(io_error)?;
    let mut backup = Connection::open(staged)?;
    db::prepare_backup(&mut backup)?;
    Ok(backup)
}

pub fn restore_from(conn: &mut Connection, file: &Path, data_dir: &Path) -> Result<()> {
    let staged = data_dir.join(STAGED_RESTORE);
    let restored = stage_backup(file, &staged).and_then(|backup| {
        export_to(conn, &data_dir.join(SAFETY_COPY))?;
        db::replace_with(conn, &backup)
    });
    remove_staged(&staged)?;
    restored
}

#[derive(Default)]
pub struct SeenVersion(AtomicI64);

fn data_version(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("PRAGMA data_version", [], |row| row.get(0))?)
}

fn changed_since(seen: &SeenVersion, version: i64) -> bool {
    let previous = seen.0.swap(version, Ordering::Relaxed);
    previous != 0 && previous != version
}

#[tauri::command]
#[specta::specta]
pub async fn external_changes(db: State<'_, Db>, seen: State<'_, SeenVersion>) -> Result<bool> {
    let version = db.call(|conn| data_version(conn))?;
    Ok(changed_since(&seen, version))
}

#[tauri::command]
#[specta::specta]
pub async fn export_data(app: AppHandle, db: State<'_, Db>) -> Result<Option<String>> {
    let path = app
        .dialog()
        .file()
        .set_title("Export a backup")
        .set_file_name(format!("skkil-time-{}.db", Date::today().0))
        .add_filter(BACKUP_FILTER, &[BACKUP_EXTENSION])
        .blocking_save_file()
        .and_then(|file| file.into_path().ok());
    let Some(path) = path else {
        return Ok(None);
    };
    db.call(|conn| export_to(conn, &path))?;
    Ok(Some(path.display().to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn import_data(
    app: AppHandle,
    db: State<'_, Db>,
    timer: State<'_, Timer>,
    undo: State<'_, UndoLog>,
) -> Result<bool> {
    let path: Option<PathBuf> = app
        .dialog()
        .file()
        .set_title("Restore from a backup")
        .add_filter(BACKUP_FILTER, &[BACKUP_EXTENSION])
        .blocking_pick_file()
        .and_then(|file| file.into_path().ok());
    let Some(path) = path else {
        return Ok(false);
    };
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| Error::invalid(error.to_string()))?;
    db.call(|conn| restore_from(conn, &path, &data_dir))?;
    timer.with(|running| *running = None);
    undo.clear();
    Ok(true)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_all_data(
    db: State<'_, Db>,
    timer: State<'_, Timer>,
    undo: State<'_, UndoLog>,
) -> Result<()> {
    timer.with(|running| *running = None);
    undo.clear();
    db.call(db::reset)
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    fn count(conn: &Connection, table: &str) -> Result<i64> {
        Ok(
            conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })?,
        )
    }

    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("skkil-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn notices_writes_from_another_process() -> Result<()> {
        let dir = scratch_dir("external");
        let path = dir.join("time.db");
        let app = Db::open(&path)?;
        let other = Db::open(&path)?;
        let seen = SeenVersion::default();
        let check = || {
            app.call(|conn| data_version(conn))
                .map(|v| changed_since(&seen, v))
        };
        assert!(!check()?);
        app.call(|conn| Ok(conn.execute("INSERT INTO project_group (name) VALUES ('Own')", [])?))?;
        assert!(!check()?);
        other.call(|conn| {
            Ok(conn.execute("INSERT INTO project_group (name) VALUES ('MCP')", [])?)
        })?;
        assert!(check()?);
        assert!(!check()?);
        fs::remove_dir_all(&dir).map_err(io_error)
    }

    #[test]
    fn reset_empties_data_and_restores_defaults() {
        let db = Db::in_memory();
        db.call(|conn| {
            let rituals = count(conn, "ritual")?;
            conn.execute_batch(
                "INSERT INTO project (name) VALUES ('Thesis');
                 DELETE FROM ritual;",
            )?;

            db::reset(conn)?;

            assert_eq!(count(conn, "project")?, 0);
            assert_eq!(count(conn, "ritual")?, rituals);
            assert!(rituals > 0);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn a_backup_restores_after_the_data_changed_and_keeps_a_safety_copy() {
        let dir = scratch_dir("backup");
        let file = dir.join("backup.db");
        let db = Db::in_memory();
        db.call(|conn| {
            conn.execute_batch("INSERT INTO project (name) VALUES ('Thesis');")?;
            export_to(conn, &file)?;
            conn.execute_batch(
                "DELETE FROM project;
                 INSERT INTO project (name) VALUES ('Newer'), ('Newest');",
            )?;

            restore_from(conn, &file, &dir)?;

            let name: String = conn.query_row("SELECT name FROM project", [], |row| row.get(0))?;
            assert_eq!(name, "Thesis");
            assert_eq!(count(conn, "project")?, 1);
            conn.execute_batch("INSERT INTO project (name) VALUES ('After restore');")?;

            let safety = Connection::open(dir.join(SAFETY_COPY))?;
            assert_eq!(count(&safety, "project")?, 2);
            assert!(!dir.join(STAGED_RESTORE).exists());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn restores_into_a_live_file_database() {
        let dir = scratch_dir("live");
        let file = dir.join("backup.db");
        let db = Db::open(&dir.join("time.db")).unwrap();
        db.call(|conn| {
            conn.execute_batch("INSERT INTO project (name) VALUES ('Thesis');")?;
            export_to(conn, &file)?;
            conn.execute_batch("DELETE FROM project;")?;
            restore_from(conn, &file, &dir)?;
            assert_eq!(count(conn, "project")?, 1);
            Ok(())
        })
        .unwrap();
        drop(db);

        let reopened = Db::open(&dir.join("time.db")).unwrap();
        reopened
            .call(|conn| {
                assert_eq!(count(conn, "project")?, 1);
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn export_replaces_an_existing_file() {
        let dir = scratch_dir("overwrite");
        let file = dir.join("backup.db");
        fs::write(&file, "old").unwrap();
        let db = Db::in_memory();
        db.call(|conn| export_to(conn, &file)).unwrap();
        assert!(Connection::open(&file).is_ok_and(|backup| count(&backup, "task").is_ok()));
    }

    #[test]
    fn refuses_files_that_are_not_backups_and_leaves_the_data_alone() {
        let dir = scratch_dir("reject");
        let text = dir.join("notes.txt");
        fs::write(&text, "not a database").unwrap();
        let other = dir.join("other.db");
        Connection::open(&other)
            .unwrap()
            .execute_batch("CREATE TABLE recipe (id INTEGER);")
            .unwrap();
        let newer = dir.join("newer.db");
        let db = Db::in_memory();
        db.call(|conn| {
            conn.execute_batch("INSERT INTO project (name) VALUES ('Thesis');")?;
            export_to(conn, &newer)?;
            Connection::open(&newer)?.pragma_update(None, "user_version", 9999)?;

            assert!(restore_from(conn, &text, &dir).is_err());
            assert!(restore_from(conn, &other, &dir).is_err());
            assert!(restore_from(conn, &newer, &dir).is_err());
            assert_eq!(count(conn, "project")?, 1);
            assert!(!dir.join(SAFETY_COPY).exists());
            Ok(())
        })
        .unwrap();
    }
}
