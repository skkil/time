use std::path::Path;

use rusqlite::Connection;
use time_core::Result;
use time_core::db::{self, Db, UUID_IDS_VERSION};

pub const DATABASE_FILE: &str = "time.db";
const BEFORE_UUIDS_COPY: &str = "time-before-uuid.db";

/// Opens the database file in WAL mode and migrates it, first keeping a
/// copy next to it when this open switches its integer ids to UUIDs.
pub fn open(path: &Path) -> Result<Db> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    keep_copy_before_uuids(&conn, path)?;
    Db::new(conn)
}

fn keep_copy_before_uuids(conn: &Connection, path: &Path) -> Result<()> {
    let version = db::schema_version(conn)?;
    let copy = path.with_file_name(BEFORE_UUIDS_COPY);
    if version == 0 || version >= UUID_IDS_VERSION || copy.exists() {
        return Ok(());
    }
    conn.execute("VACUUM INTO ?1", [copy.to_string_lossy()])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn keeps_one_copy_of_an_integer_id_database() {
        let dir = std::env::temp_dir().join(format!("skkil-uuid-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(DATABASE_FILE);
        let mut old = Connection::open(&path).unwrap();
        db::migrate_to(&mut old, UUID_IDS_VERSION - 1).unwrap();
        old.execute("INSERT INTO project (id, name) VALUES (7, 'Thesis')", [])
            .unwrap();
        drop(old);

        let migrated = open(&path).unwrap();
        let copy = dir.join(BEFORE_UUIDS_COPY);
        let kept: i64 = Connection::open(&copy)
            .unwrap()
            .query_row("SELECT id FROM project", [], |row| row.get(0))
            .unwrap();
        assert_eq!(kept, 7);
        let id: String = migrated
            .call(|conn| Ok(conn.query_row("SELECT id FROM project", [], |row| row.get(0))?))
            .unwrap();
        assert!(time_core::types::Id::parse(&id).is_ok());
        drop(migrated);

        fs::write(&copy, "first copy").unwrap();
        open(&path).unwrap();
        assert_eq!(fs::read_to_string(&copy).unwrap(), "first copy");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_new_database_needs_no_copy() {
        let dir = std::env::temp_dir().join(format!("skkil-fresh-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        open(&dir.join(DATABASE_FILE)).unwrap();
        assert!(!dir.join(BEFORE_UUIDS_COPY).exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}
