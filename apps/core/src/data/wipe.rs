use rusqlite::Connection;

use super::tables::SYNCED_TABLES;
use crate::error::Result;
use crate::rituals::reset_rituals;

/// `deleteAllData`: removes every synced row except the five rituals, which
/// go back to their defaults in place. Device settings stay.
pub fn delete_all(conn: &Connection) -> Result<()> {
    for table in SYNCED_TABLES.iter().rev().filter(|table| **table != "ritual") {
        conn.execute(&format!("DELETE FROM {table}"), [])?;
    }
    reset_rituals(conn)
}
