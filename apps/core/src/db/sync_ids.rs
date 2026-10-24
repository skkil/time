use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::env::SeedScope;
use crate::error::Result;
use crate::rituals::ritual_id;

/// Tables keyed by something other than an id (a date, a pair, a key) that
/// get an `id` column, the row id store syncs them by.
pub const KEYED_TABLES: [&str; 7] = [
    "setting",
    "project_canvas",
    "week",
    "day",
    "task_dependency",
    "record_phase",
    "habit_log",
];

/// Settings that belong to one device and never sync.
pub const DEVICE_KEYS: [&str; 1] = ["capture_hotkey"];

const CREATE: &str = "
CREATE TABLE device_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE running_timer_new (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  paused_at INTEGER,
  banked_seconds INTEGER NOT NULL DEFAULT 0
);
";

const COPY_TIMER: &str = "
INSERT INTO running_timer_new
SELECT ?1, description, project_id, task_id, started_at, paused_at, banked_seconds
  FROM running_timer
";

const SWAP: &str = "
DROP TABLE running_timer;
ALTER TABLE running_timer_new RENAME TO running_timer;
";

/// Migration 019: gives every synced row a single id column, the shape the
/// server registers with store. Keyed tables get a UUIDv7 per row, rituals
/// their seeded id, the running timer a text id, and device settings move
/// to `device_setting`.
pub fn migrate(conn: &Connection) -> Result<()> {
    for table in KEYED_TABLES {
        conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN id TEXT"))?;
        let rows: Vec<i64> = conn
            .prepare(&format!("SELECT rowid FROM {table} ORDER BY rowid"))?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for rowid in rows {
            conn.execute(
                &format!("UPDATE {table} SET id = ?1 WHERE rowid = ?2"),
                params![Uuid::now_v7().to_string(), rowid],
            )?;
        }
        conn.execute_batch(&format!("CREATE UNIQUE INDEX {table}_id ON {table}(id)"))?;
    }

    conn.execute_batch("ALTER TABLE ritual ADD COLUMN id TEXT")?;
    let kinds: Vec<String> = conn
        .prepare("SELECT kind FROM ritual")?
        .query_map([], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    for kind in kinds {
        conn.execute(
            "UPDATE ritual SET id = ?1 WHERE kind = ?2",
            params![ritual_id(SeedScope::Local, &kind), kind],
        )?;
    }
    conn.execute_batch("CREATE UNIQUE INDEX ritual_id ON ritual(id)")?;

    conn.execute_batch(CREATE)?;
    conn.execute(COPY_TIMER, params![Uuid::now_v7().to_string()])?;
    conn.execute_batch(SWAP)?;

    for key in DEVICE_KEYS {
        conn.execute(
            "INSERT INTO device_setting (key, value) SELECT key, value FROM setting WHERE key = ?1",
            params![key],
        )?;
        conn.execute("DELETE FROM setting WHERE key = ?1", params![key])?;
    }
    Ok(())
}
