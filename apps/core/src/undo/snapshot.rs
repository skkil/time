use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};

use crate::error::{Error, Result};
use crate::tasks;
use crate::types::Id;

const COPIED_TABLES: [&str; 2] = ["time_block", "record_phase"];
const LINKED_TABLES: [&str; 2] = ["time_entry", "ritual_run"];

struct Rows {
    table: &'static str,
    columns: Vec<String>,
    values: Vec<Vec<Value>>,
}

/// Tasks with every sub-task, their blocks, phase notes, dependencies and
/// the entries and ritual runs linked to them, as they were when captured.
pub struct TaskSnapshot {
    tasks: Rows,
    created: Vec<(Id, i64)>,
    copies: Vec<Rows>,
    dependencies: Vec<(Id, Id)>,
    links: Vec<(&'static str, Id, Id)>,
}

fn sql_list(ids: &[Id]) -> String {
    ids.iter()
        .map(|id| format!("'{}'", id.as_str().replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(",")
}

fn read(conn: &Connection, table: &'static str, filter: &str) -> Result<Rows> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table} WHERE {filter}"))?;
    let columns: Vec<String> = stmt.column_names().map(str::to_owned).collect();
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
        subtree.push(id.clone());
        subtree.extend(tasks::descendants(conn, id)?);
    }
    let list = sql_list(&subtree);

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

/// Puts the captured rows back, relinking entries and runs that lost their
/// task. Refuses when a container the tasks need is gone.
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
