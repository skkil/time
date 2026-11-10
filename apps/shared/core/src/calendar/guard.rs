use rusqlite::Connection;

use crate::data::SERVER_TABLES;
use crate::error::Result;

const EVENTS: [&str; 3] = ["INSERT", "UPDATE", "DELETE"];

/// Refuses every write a mutation makes to a table only the server
/// writes, such as `calendar_event`: store captures each mutation, and the
/// rows of these tables arrive only through pulls, which it doesn't capture.
/// Call it after store is installed.
pub fn guard(conn: &Connection) -> Result<()> {
    for table in SERVER_TABLES {
        for event in EVENTS {
            conn.execute_batch(&format!(
                "CREATE TRIGGER IF NOT EXISTS {table}_server_only_{kind} BEFORE {event} ON {table}
                 WHEN (SELECT capture_mutation_id FROM store_meta) IS NOT NULL
                 BEGIN SELECT RAISE(ABORT, 'Only the server changes {table} rows.'); END",
                kind = event.to_lowercase(),
            ))?;
        }
    }
    Ok(())
}
