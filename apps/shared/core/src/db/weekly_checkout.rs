use rusqlite::Connection;

use crate::error::Result;

/// Migration 023: the weekly review moved into the evening checkout, so the
/// standalone weekly ritual stops opening by itself unless someone set it to.
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute(
        "UPDATE ritual SET trigger = 'manual' WHERE kind = 'weekly' AND trigger = 'first_open'",
        [],
    )?;
    Ok(())
}
