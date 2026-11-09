use std::collections::HashMap;

use rusqlite::{Connection, params};
use serde_json::Value;
use uuid::{Builder, Uuid};

use crate::error::Result;

/// Tables whose rows have their own integer id, in an order where every
/// referenced table comes first.
pub const ENTITY_TABLES: [&str; 15] = [
    "project_group",
    "project",
    "section",
    "quarter",
    "priority",
    "outcome",
    "item_type",
    "item_status",
    "milestone",
    "saved_view",
    "task",
    "time_block",
    "time_entry",
    "habit",
    "ritual_run",
];

const REBUILD: &str = include_str!("migrations/017_uuid_ids.sql");

/// Migration 017: gives every row a UUIDv7 in place of its integer id and
/// points every foreign key at the new ids. UUIDs are minted in old-id order
/// with timestamps in the past, so text order keeps creation order and stays
/// before anything created afterwards.
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TEMP TABLE id_map (
           tbl TEXT NOT NULL,
           old INTEGER NOT NULL,
           new TEXT NOT NULL,
           PRIMARY KEY (tbl, old)
         )",
    )?;
    let mut minted = Minter::new(row_count(conn)?);
    for table in ENTITY_TABLES {
        let ids: Vec<i64> = conn
            .prepare(&format!("SELECT id FROM {table} ORDER BY id"))?
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        let mut insert = conn.prepare("INSERT INTO id_map (tbl, old, new) VALUES (?1, ?2, ?3)")?;
        for id in ids {
            insert.execute(params![table, id, minted.next()])?;
        }
    }
    conn.execute_batch(REBUILD)?;
    remap_view_filters(conn)?;
    conn.execute_batch("DROP TABLE temp.id_map")?;
    Ok(())
}

fn row_count(conn: &Connection) -> Result<u64> {
    let mut total = 0;
    for table in ENTITY_TABLES {
        let count: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })?;
        total += count as u64;
    }
    Ok(total)
}

struct Minter {
    next_millis: u64,
}

impl Minter {
    fn new(rows: u64) -> Self {
        let now = Uuid::now_v7().get_timestamp().map_or(0, |at| {
            let (seconds, nanos) = at.to_unix();
            seconds * 1000 + u64::from(nanos) / 1_000_000
        });
        Self {
            next_millis: now.saturating_sub(rows + 1),
        }
    }

    fn next(&mut self) -> String {
        let random = Uuid::now_v7();
        let tail: [u8; 10] = random.as_bytes()[6..].try_into().expect("ten bytes");
        let uuid = Builder::from_unix_timestamp_millis(self.next_millis, &tail).into_uuid();
        self.next_millis += 1;
        uuid.hyphenated().to_string()
    }
}

fn remap_view_filters(conn: &Connection) -> Result<()> {
    let types: HashMap<i64, String> = conn
        .prepare("SELECT old, new FROM id_map WHERE tbl = 'item_type'")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    let views: Vec<(String, String)> = conn
        .prepare("SELECT id, filter FROM saved_view WHERE filter LIKE '%typeIds%'")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    for (id, filter) in views {
        let Ok(mut parsed) = serde_json::from_str::<Value>(&filter) else {
            continue;
        };
        let Some(ids) = parsed.get_mut("typeIds").and_then(Value::as_array_mut) else {
            continue;
        };
        *ids = ids
            .iter()
            .filter_map(Value::as_i64)
            .filter_map(|old| types.get(&old).cloned().map(Value::String))
            .collect();
        conn.execute(
            "UPDATE saved_view SET filter = ?1 WHERE id = ?2",
            params![parsed.to_string(), id],
        )?;
    }
    Ok(())
}
