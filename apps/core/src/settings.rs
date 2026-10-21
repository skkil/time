use rusqlite::{Connection, OptionalExtension, params};

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

pub fn write(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO setting (key, value) VALUES (?1, ?2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn switch_on(conn: &Connection, key: &str) -> Result<bool> {
    Ok(read(conn, key)?.as_deref() != Some("off"))
}

pub fn set_switch(conn: &Connection, key: &str, on: bool) -> Result<()> {
    write(conn, key, if on { "on" } else { "off" })
}
