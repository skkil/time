use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, tasks};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Date, Id, Timestamp};

const MINUTE: i64 = 60;
const MAX_BLOCK_SECONDS: i64 = Timestamp::DAY;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimeBlock {
    pub id: Id,
    pub task_id: Id,
    pub title: String,
    pub project_id: Option<Id>,
    pub priority: i32,
    pub completed: bool,
    pub start_at: Timestamp,
    pub end_at: Timestamp,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BlockSpan {
    pub start_at: Timestamp,
    pub end_at: Timestamp,
}

const SELECT: &str = "SELECT b.id, b.task_id, t.title, t.project_id, t.priority, t.completed_at IS NOT NULL,
       b.start_at, b.end_at
     FROM time_block b JOIN task t ON t.id = b.task_id";

fn from_row(row: &Row) -> rusqlite::Result<TimeBlock> {
    Ok(TimeBlock {
        id: row.get(0)?,
        task_id: row.get(1)?,
        title: row.get(2)?,
        project_id: row.get(3)?,
        priority: row.get(4)?,
        completed: row.get(5)?,
        start_at: row.get(6)?,
        end_at: row.get(7)?,
    })
}

fn get(conn: &Connection, id: Id) -> Result<TimeBlock> {
    conn.query_row(&format!("{SELECT} WHERE b.id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Time block"))
}

fn validate(span: &BlockSpan) -> Result<()> {
    if span.start_at.0 % MINUTE != 0 || span.end_at.0 % MINUTE != 0 {
        return Err(Error::invalid("Blocks start and end on whole minutes."));
    }
    let length = span.start_at.seconds_until(span.end_at);
    if length <= 0 {
        return Err(Error::invalid("A block must end after it starts."));
    }
    if length > MAX_BLOCK_SECONDS {
        return Err(Error::invalid("A block can't be longer than 24 hours."));
    }
    Ok(())
}

pub fn list(conn: &Connection, from: Date, to: Date) -> Result<Vec<TimeBlock>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT} WHERE b.start_at >= ?1 AND b.start_at < ?2 ORDER BY b.start_at"
    ))?;
    let rows = stmt.query_map(params![from.start(), to.start()], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn create(conn: &Connection, task_id: Id, span: &BlockSpan) -> Result<TimeBlock> {
    validate(span)?;
    tasks::get(conn, task_id)?;
    conn.execute(
        "INSERT INTO time_block (task_id, start_at, end_at) VALUES (?1, ?2, ?3)",
        params![task_id, span.start_at, span.end_at],
    )?;
    get(conn, Id(conn.last_insert_rowid()))
}

pub fn reschedule(conn: &Connection, id: Id, span: &BlockSpan) -> Result<TimeBlock> {
    validate(span)?;
    let rows = conn.execute(
        "UPDATE time_block SET start_at = ?1, end_at = ?2 WHERE id = ?3",
        params![span.start_at, span.end_at, id],
    )?;
    ensure_changed(rows, "Time block")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM time_block WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Time block")
}

#[tauri::command]
#[specta::specta]
pub async fn list_blocks(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<TimeBlock>> {
    db.call(|conn| list(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn create_block(db: State<'_, Db>, task_id: Id, span: BlockSpan) -> Result<TimeBlock> {
    db.call(|conn| create(conn, task_id, &span))
}

#[tauri::command]
#[specta::specta]
pub async fn reschedule_block(db: State<'_, Db>, id: Id, span: BlockSpan) -> Result<TimeBlock> {
    db.call(|conn| reschedule(conn, id, &span))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_block(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::date;

    #[test]
    fn schedules_tasks_and_cascades_on_delete() {
        let db = Db::in_memory();
        db.call(|conn| {
            let task = tasks::create(conn, &tasks::input("Write intro", None))?;
            let monday = date("2026-11-02");
            let start = Timestamp(monday.start().0 + 9 * 3600);
            let span = BlockSpan {
                start_at: start,
                end_at: Timestamp(start.0 + 3600),
            };
            let block = create(conn, task.id, &span)?;
            assert_eq!(block.title, "Write intro");
            assert_eq!(list(conn, monday, monday.add_days(7))?.len(), 1);

            tasks::delete(conn, task.id)?;
            assert!(list(conn, monday, monday.add_days(7))?.is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rejects_bad_spans() {
        let db = Db::in_memory();
        db.call(|conn| {
            let task = tasks::create(conn, &tasks::input("Read", None))?;
            let backwards = BlockSpan {
                start_at: Timestamp(7200),
                end_at: Timestamp(3600),
            };
            let ragged = BlockSpan {
                start_at: Timestamp(3601),
                end_at: Timestamp(7200),
            };
            assert!(create(conn, task.id, &backwards).is_err());
            assert!(create(conn, task.id, &ragged).is_err());
            Ok(())
        })
        .unwrap();
    }
}
