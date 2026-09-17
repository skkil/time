use std::collections::VecDeque;
use std::sync::Mutex;

use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use tauri::State;

use super::tasks;
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::Id;

const KEPT_SNAPSHOTS: usize = 50;
const COPIED_TABLES: [&str; 2] = ["time_block", "record_phase"];
const LINKED_TABLES: [&str; 2] = ["time_entry", "ritual_run"];

struct Rows {
    table: &'static str,
    columns: Vec<String>,
    values: Vec<Vec<Value>>,
}

pub struct TaskSnapshot {
    tasks: Rows,
    created: Vec<(Id, i64)>,
    copies: Vec<Rows>,
    dependencies: Vec<(Id, Id)>,
    links: Vec<(&'static str, Id, Id)>,
}

#[derive(Default)]
pub struct UndoLog(Mutex<Log>);

#[derive(Default)]
struct Log {
    next: i64,
    snapshots: VecDeque<(Id, TaskSnapshot)>,
}

impl UndoLog {
    fn with<T>(&self, run: impl FnOnce(&mut Log) -> T) -> T {
        let mut log = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        run(&mut log)
    }

    fn keep(&self, snapshot: TaskSnapshot) -> Id {
        self.with(|log| {
            log.next += 1;
            let id = Id(log.next);
            log.snapshots.push_back((id, snapshot));
            if log.snapshots.len() > KEPT_SNAPSHOTS {
                log.snapshots.pop_front();
            }
            id
        })
    }

    fn take(&self, id: Id) -> Option<TaskSnapshot> {
        self.with(|log| {
            let at = log.snapshots.iter().position(|(kept, _)| *kept == id)?;
            log.snapshots.remove(at).map(|(_, snapshot)| snapshot)
        })
    }
}

fn read(conn: &Connection, table: &'static str, filter: &str) -> Result<Rows> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table} WHERE {filter}"))?;
    let columns: Vec<String> = stmt.column_names().into_iter().map(str::to_owned).collect();
    let width = columns.len();
    let values = stmt
        .query_map([], |row| (0..width).map(|index| row.get(index)).collect())?
        .collect::<rusqlite::Result<_>>()?;
    Ok(Rows {
        table,
        columns,
        values,
    })
}

fn pairs<T>(conn: &Connection, sql: &str, pair: impl Fn(Id, Id) -> T) -> Result<Vec<T>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| Ok(pair(row.get(0)?, row.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn capture(conn: &Connection, ids: &[Id]) -> Result<TaskSnapshot> {
    let mut subtree = Vec::new();
    for id in ids {
        subtree.push(*id);
        subtree.extend(tasks::descendants(conn, *id)?);
    }
    let list = subtree
        .iter()
        .map(|id| id.0.to_string())
        .collect::<Vec<_>>()
        .join(",");

    let tasks = read(conn, "task", &format!("id IN ({list})"))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT id, created_at FROM task WHERE id IN ({list})"
    ))?;
    let created = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;

    let copies = COPIED_TABLES
        .iter()
        .map(|table| read(conn, table, &format!("task_id IN ({list})")))
        .collect::<Result<_>>()?;
    let dependencies = pairs(
        conn,
        &format!(
            "SELECT task_id, blocked_by_id FROM task_dependency
             WHERE task_id IN ({list}) OR blocked_by_id IN ({list})"
        ),
        |task, blocker| (task, blocker),
    )?;
    let mut links = Vec::new();
    for table in LINKED_TABLES {
        links.extend(pairs(
            conn,
            &format!("SELECT id, task_id FROM {table} WHERE task_id IN ({list})"),
            |row, task| (table, row, task),
        )?);
    }

    Ok(TaskSnapshot {
        tasks,
        created,
        copies,
        dependencies,
        links,
    })
}

fn write(conn: &Connection, rows: &Rows, conflict: &str) -> Result<()> {
    let columns = rows.columns.join(", ");
    let slots = vec!["?"; rows.columns.len()].join(", ");
    let mut stmt = conn.prepare(&format!(
        "INSERT INTO {} ({columns}) VALUES ({slots}) {conflict}",
        rows.table
    ))?;
    for row in &rows.values {
        stmt.execute(params_from_iter(row))?;
    }
    Ok(())
}

fn ensure_ids_are_free(conn: &Connection, snapshot: &TaskSnapshot) -> Result<()> {
    for (id, created_at) in &snapshot.created {
        let current: Option<i64> = conn
            .query_row(
                "SELECT created_at FROM task WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;
        if current.is_some_and(|current| current != *created_at) {
            return Err(Error::invalid(
                "A newer task took its place, so this can't be undone.",
            ));
        }
    }
    Ok(())
}

pub fn restore(conn: &mut Connection, snapshot: &TaskSnapshot) -> Result<()> {
    ensure_ids_are_free(conn, snapshot)?;
    let tx = conn.transaction()?;
    tx.pragma_update(None, "defer_foreign_keys", true)?;

    let updates = snapshot
        .tasks
        .columns
        .iter()
        .filter(|column| *column != "id")
        .map(|column| format!("{column} = excluded.{column}"))
        .collect::<Vec<_>>()
        .join(", ");
    write(
        &tx,
        &snapshot.tasks,
        &format!("ON CONFLICT (id) DO UPDATE SET {updates}"),
    )?;
    for rows in &snapshot.copies {
        write(&tx, rows, "ON CONFLICT DO NOTHING")?;
    }
    for (task, blocker) in &snapshot.dependencies {
        tx.execute(
            "INSERT OR IGNORE INTO task_dependency (task_id, blocked_by_id)
             SELECT ?1, ?2
             WHERE EXISTS (SELECT 1 FROM task WHERE id = ?1)
               AND EXISTS (SELECT 1 FROM task WHERE id = ?2)",
            params![task, blocker],
        )?;
    }
    for (table, row, task) in &snapshot.links {
        tx.execute(
            &format!("UPDATE {table} SET task_id = ?1 WHERE id = ?2 AND task_id IS NULL"),
            params![task, row],
        )?;
    }

    tx.commit()
        .map_err(|_| Error::invalid("Its project or section is gone, so this can't be undone."))
}

#[tauri::command]
#[specta::specta]
pub async fn capture_tasks(db: State<'_, Db>, log: State<'_, UndoLog>, ids: Vec<Id>) -> Result<Id> {
    let snapshot = db.call(|conn| capture(conn, &ids))?;
    Ok(log.keep(snapshot))
}

#[tauri::command]
#[specta::specta]
pub async fn restore_tasks(db: State<'_, Db>, log: State<'_, UndoLog>, snapshot: Id) -> Result<()> {
    let snapshot = log
        .take(snapshot)
        .ok_or_else(|| Error::invalid("This can no longer be undone."))?;
    db.call(|conn| restore(conn, &snapshot))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::blocks::{self, BlockSpan};
    use crate::features::{dependencies, time_entries};
    use crate::types::{Date, Timestamp, date};

    fn span(start: i64) -> BlockSpan {
        BlockSpan {
            start_at: Timestamp(start),
            end_at: Timestamp(start + 3600),
        }
    }

    #[test]
    fn deleted_tasks_return_with_steps_blocks_links_and_history() {
        let db = Db::in_memory();
        db.call(|conn| {
            let task = tasks::create(conn, &tasks::input("Write intro", None))?;
            let mut step = tasks::input("Outline", None);
            step.parent_id = Some(task.id);
            let step = tasks::create(conn, &step)?;
            let held = tasks::create(conn, &tasks::input("Send draft", None))?;
            dependencies::add(conn, held.id, task.id)?;
            let start = date("2026-11-02").start().0;
            blocks::create(conn, task.id, &span(start))?;
            let entry = time_entries::create(
                conn,
                &time_entries::EntryInput {
                    details: time_entries::EntryDetails {
                        description: String::new(),
                        project_id: None,
                        task_id: Some(task.id),
                    },
                    started_at: Timestamp(start),
                    ended_at: Timestamp(start + 600),
                },
            )?;

            let snapshot = capture(conn, &[task.id])?;
            tasks::delete(conn, task.id)?;
            assert!(tasks::get(conn, step.id).is_err());

            restore(conn, &snapshot)?;

            assert_eq!(tasks::get(conn, task.id)?.title, "Write intro");
            assert_eq!(tasks::get(conn, step.id)?.parent_id, Some(task.id));
            assert_eq!(tasks::get(conn, held.id)?.blocked_by, vec![task.id]);
            let monday = date("2026-11-02");
            assert_eq!(blocks::list(conn, monday, monday.add_days(7))?.len(), 1);
            let linked: Option<Id> = conn.query_row(
                "SELECT task_id FROM time_entry WHERE id = ?1",
                params![entry.id],
                |row| row.get(0),
            )?;
            assert_eq!(linked, Some(task.id));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn undoing_done_reopens_steps_and_rewinds_a_repeat() {
        let db = Db::in_memory();
        db.call(|conn| {
            let parent = tasks::create(conn, &tasks::input("Pack", None))?;
            let mut step = tasks::input("Socks", None);
            step.parent_id = Some(parent.id);
            let step = tasks::create(conn, &step)?;
            let snapshot = capture(conn, &[parent.id])?;
            tasks::set_completed(conn, parent.id, true)?;
            restore(conn, &snapshot)?;
            assert!(tasks::get(conn, parent.id)?.completed_at.is_none());
            assert!(tasks::get(conn, step.id)?.completed_at.is_none());

            let mut repeat = tasks::input("Water plants", None);
            repeat.due_date = Some(Date::today());
            repeat.recurrence = Some("every day".into());
            let repeat = tasks::create(conn, &repeat)?;
            let due = repeat.due_date;
            let snapshot = capture(conn, &[repeat.id])?;
            tasks::set_completed(conn, repeat.id, true)?;
            assert_ne!(tasks::get(conn, repeat.id)?.due_date, due);
            restore(conn, &snapshot)?;
            assert_eq!(tasks::get(conn, repeat.id)?.due_date, due);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn refuses_to_overwrite_a_task_that_reused_the_id() {
        let db = Db::in_memory();
        db.call(|conn| {
            let task = tasks::create(conn, &tasks::input("Old", None))?;
            let snapshot = capture(conn, &[task.id])?;
            tasks::delete(conn, task.id)?;
            conn.execute(
                "INSERT INTO task (id, title, created_at) VALUES (?1, 'New', 1)",
                params![task.id],
            )?;

            assert!(restore(conn, &snapshot).is_err());
            assert_eq!(tasks::get(conn, task.id)?.title, "New");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn the_log_keeps_only_recent_snapshots() {
        let db = Db::in_memory();
        let log = UndoLog::default();
        let first = db
            .call(|conn| capture(conn, &[]))
            .map(|snapshot| log.keep(snapshot))
            .unwrap();
        for _ in 0..KEPT_SNAPSHOTS {
            log.keep(db.call(|conn| capture(conn, &[])).unwrap());
        }
        assert!(log.take(first).is_none());
    }
}
