use rusqlite::{Connection, params};

use crate::error::Result;
use crate::types::Id;

/// Whether `blocked_by_id` already waits on `task_id`, directly or through
/// other tasks.
pub fn would_loop(conn: &Connection, task_id: &Id, blocked_by_id: &Id) -> Result<bool> {
    Ok(conn.query_row(
        "WITH RECURSIVE up(id) AS (
           SELECT ?1
           UNION
           SELECT d.blocked_by_id FROM task_dependency d JOIN up ON d.task_id = up.id
         )
         SELECT EXISTS(SELECT 1 FROM up WHERE id = ?2)",
        params![blocked_by_id, task_id],
        |row| row.get(0),
    )?)
}
