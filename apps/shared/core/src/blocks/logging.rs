use rusqlite::{Connection, params};

use crate::env::MutationEnv;
use crate::error::Result;
use crate::settings;
use crate::types::{Id, Timestamp};

const SETTING: &str = "auto_log_blocks";
pub const LOOKBACK_SECONDS: i64 = 2 * Timestamp::DAY;

struct Ended {
    id: Id,
    task_id: Id,
    start_at: Timestamp,
    end_at: Timestamp,
}

pub fn enabled(conn: &Connection) -> Result<bool> {
    settings::switch_on(conn, SETTING)
}

pub fn set_enabled(conn: &Connection, env: &dyn MutationEnv, enabled: bool) -> Result<()> {
    settings::set_switch(conn, env, SETTING, enabled)
}

/// Blocks that ended in the last two days, haven't been logged and whose task
/// isn't being timed right now.
fn ended(conn: &Connection, now: Timestamp) -> Result<Vec<Ended>> {
    let mut stmt = conn.prepare(
        "SELECT b.id, b.task_id, b.start_at, b.end_at
         FROM time_block b JOIN task t ON t.id = b.task_id
         WHERE b.logged = 0 AND b.end_at <= ?1 AND b.end_at > ?2
           AND NOT EXISTS (SELECT 1 FROM running_timer r WHERE r.task_id = b.task_id)
         ORDER BY b.start_at, b.id",
    )?;
    let rows = stmt.query_map(params![now, Timestamp(now.0 - LOOKBACK_SECONDS)], |row| {
        Ok(Ended {
            id: row.get(0)?,
            task_id: row.get(1)?,
            start_at: row.get(2)?,
            end_at: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn count_ended(conn: &Connection, now: Timestamp) -> Result<i32> {
    if !enabled(conn)? {
        return Ok(0);
    }
    Ok(ended(conn, now)?.len() as i32)
}

/// Logs each ended block as tracked time on its task, unless time was already
/// tracked on that task during the block. Each block is handled once.
pub fn log_ended(conn: &Connection, env: &dyn MutationEnv) -> Result<i32> {
    if !enabled(conn)? {
        return Ok(0);
    }
    let mut logged = 0;
    for block in ended(conn, env.timestamp())? {
        let tracked: bool = conn.query_row(
            "SELECT EXISTS (SELECT 1 FROM time_entry
                            WHERE task_id = ?1 AND started_at < ?3 AND ended_at > ?2)",
            params![block.task_id, block.start_at, block.end_at],
            |row| row.get(0),
        )?;
        if !tracked {
            conn.execute(
                "INSERT INTO time_entry
                   (id, description, project_id, task_id, started_at, ended_at, source)
                 SELECT ?1, t.title, t.project_id, t.id, ?3, ?4, 'block'
                 FROM task t WHERE t.id = ?2",
                params![env.next_id(), block.task_id, block.start_at, block.end_at],
            )?;
            logged += 1;
        }
        conn.execute(
            "UPDATE time_block SET logged = 1 WHERE id = ?1",
            params![block.id],
        )?;
    }
    Ok(logged)
}
