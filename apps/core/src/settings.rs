//! Account-wide settings: one row per key in `setting`, synced like any
//! other row. Device settings live in [`crate::device_settings`].

use rusqlite::{Connection, OptionalExtension, params};

use crate::env::{MutationEnv, NaturalKey};
use crate::error::Result;

pub fn read(conn: &Connection, key: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT value FROM setting WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?)
}

pub fn write(conn: &Connection, env: &dyn MutationEnv, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO setting (id, key, value) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![env.keyed_id(NaturalKey::Setting(key)), key, value],
    )?;
    Ok(())
}

pub fn switch_on(conn: &Connection, key: &str) -> Result<bool> {
    Ok(read(conn, key)?.as_deref() != Some("off"))
}

pub fn set_switch(conn: &Connection, env: &dyn MutationEnv, key: &str, on: bool) -> Result<()> {
    write(conn, env, key, if on { "on" } else { "off" })
}
