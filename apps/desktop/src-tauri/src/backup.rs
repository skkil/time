use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::Duration;

use rusqlite::Connection;
use rusqlite::backup::Backup;
use time_core::db;
use time_core::{Error, Result};

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

/// Writes a compacted copy of the database to `path`.
pub fn export_to(conn: &Connection, path: &Path) -> Result<()> {
    let staged = path.with_extension("exporting");
    remove_if_present(&staged)?;
    conn.execute("VACUUM INTO ?1", [staged.to_string_lossy()])?;
    fs::rename(&staged, path).map_err(io_error)
}

/// Checks that a file is an intact skkil time backup no newer than this
/// app, and migrates it to the current schema.
fn prepare_backup(backup: &mut Connection) -> Result<()> {
    let not_a_backup = || Error::invalid("That file isn't a skkil time backup.");
    let version = db::schema_version(backup).map_err(|_| not_a_backup())?;
    if version > db::latest_version() {
        return Err(Error::invalid(
            "That backup comes from a newer version of skkil time.",
        ));
    }
    let tables: i64 = backup
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name IN ('project', 'task', 'time_entry')",
            [],
            |row| row.get(0),
        )
        .map_err(|_| not_a_backup())?;
    let intact: String = backup
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| not_a_backup())?;
    if tables != 3 || intact != "ok" {
        return Err(not_a_backup());
    }
    db::migrate(backup)
}

fn stage_backup(file: &Path, staged: &Path) -> Result<Connection> {
    remove_staged(staged)?;
    fs::copy(file, staged).map_err(io_error)?;
    let mut backup = Connection::open(staged)?;
    prepare_backup(&mut backup)?;
    Ok(backup)
}

/// Replaces the data with a backup file, keeping the current data as a
/// safety copy in `data_dir`.
pub fn restore_from(conn: &mut Connection, file: &Path, data_dir: &Path) -> Result<()> {
    let staged = data_dir.join(STAGED_RESTORE);
    let restored = stage_backup(file, &staged).and_then(|backup| {
        export_to(conn, &data_dir.join(SAFETY_COPY))?;
        Backup::new(&backup, conn)?.run_to_completion(1024, Duration::ZERO, None)?;
        Ok(())
    });
    remove_staged(&staged)?;
    restored
}

/// The last `PRAGMA data_version` this app saw, to notice writes made by
/// another process such as the MCP server.
#[derive(Default)]
pub struct SeenVersion(AtomicI64);

pub fn data_version(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("PRAGMA data_version", [], |row| row.get(0))?)
}

pub fn changed_since(seen: &SeenVersion, version: i64) -> bool {
    let previous = seen.0.swap(version, Ordering::Relaxed);
    previous != 0 && previous != version
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use time_core::db::Db;

    use super::*;
    use crate::db::open;

    fn count(conn: &Connection, table: &str) -> Result<i64> {
        Ok(
            conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })?,
        )
    }

    fn add_project(conn: &Connection, name: &str) -> Result<()> {
        conn.execute(
            "INSERT INTO project (id, name) VALUES (?1, ?2)",
            [
                time_core::env::IdSource::next_id(&time_core::env::RandomIds).to_string(),
                name.to_owned(),
            ],
        )?;
        Ok(())
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
        let app = open(&path)?;
        let other = open(&path)?;
        let seen = SeenVersion::default();
        let check = || {
            app.call(|conn| data_version(conn))
                .map(|v| changed_since(&seen, v))
        };
        assert!(!check()?);
        app.call(|conn| add_project(conn, "Own"))?;
        assert!(!check()?);
        other.call(|conn| add_project(conn, "MCP"))?;
        assert!(check()?);
        assert!(!check()?);
        fs::remove_dir_all(&dir).map_err(io_error)
    }

    #[test]
    fn a_backup_restores_after_the_data_changed_and_keeps_a_safety_copy() {
        let dir = scratch_dir("backup");
        let file = dir.join("backup.db");
        let db = Db::in_memory().unwrap();
        db.call(|conn| {
            add_project(conn, "Thesis")?;
            export_to(conn, &file)?;
            conn.execute_batch("DELETE FROM project;")?;
            add_project(conn, "Newer")?;
            add_project(conn, "Newest")?;

            restore_from(conn, &file, &dir)?;

            let name: String = conn.query_row("SELECT name FROM project", [], |row| row.get(0))?;
            assert_eq!(name, "Thesis");
            assert_eq!(count(conn, "project")?, 1);
            add_project(conn, "After restore")?;

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
        let db = open(&dir.join("time.db")).unwrap();
        db.call(|conn| {
            add_project(conn, "Thesis")?;
            export_to(conn, &file)?;
            conn.execute_batch("DELETE FROM project;")?;
            restore_from(conn, &file, &dir)?;
            assert_eq!(count(conn, "project")?, 1);
            Ok(())
        })
        .unwrap();
        drop(db);

        let reopened = open(&dir.join("time.db")).unwrap();
        reopened
            .call(|conn| {
                assert_eq!(count(conn, "project")?, 1);
                Ok(())
            })
            .unwrap();
    }

    #[test]
    fn an_old_integer_id_backup_restores_onto_uuids() {
        let dir = scratch_dir("old-backup");
        let file = dir.join("old.db");
        let mut old = Connection::open(&file).unwrap();
        db::migrate_to(&mut old, db::UUID_IDS_VERSION - 1).unwrap();
        old.execute_batch(
            "INSERT INTO project (id, name) VALUES (1, 'Thesis');
             INSERT INTO task (id, title, project_id, created_at) VALUES (1, 'Draft', 1, 0);",
        )
        .unwrap();
        drop(old);
        let db = Db::in_memory().unwrap();
        db.call(|conn| {
            restore_from(conn, &file, &dir)?;
            let project: String = conn.query_row(
                "SELECT p.name FROM task t JOIN project p ON p.id = t.project_id",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(project, "Thesis");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn export_replaces_an_existing_file() {
        let dir = scratch_dir("overwrite");
        let file = dir.join("backup.db");
        fs::write(&file, "old").unwrap();
        let db = Db::in_memory().unwrap();
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
        let db = Db::in_memory().unwrap();
        db.call(|conn| {
            add_project(conn, "Thesis")?;
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
