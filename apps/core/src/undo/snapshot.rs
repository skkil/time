use std::collections::HashSet;

use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};

use crate::env::{MutationEnv, NaturalKey};
use crate::error::{Error, Result};
use crate::tasks;
use crate::types::Id;

const TASK_TABLE: &str = "task";
const COPIED_TABLES: [&str; 2] = ["time_block", "record_phase"];
const LINKED_TABLES: [&str; 2] = ["time_entry", "ritual_run"];
const NOT_A_SNAPSHOT: &str = "That isn't a task snapshot.";
const GONE: &str = "Its project or section is gone, so this can't be undone.";

/// One captured column value: a JSON scalar. Booleans come from snapshots
/// the server took and are stored as 0 or 1.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(untagged)]
pub enum SnapshotValue {
    Null,
    Bool(bool),
    Integer(i64),
    Real(f64),
    Text(String),
}

impl From<Value> for SnapshotValue {
    fn from(value: Value) -> Self {
        match value {
            Value::Null | Value::Blob(_) => Self::Null,
            Value::Integer(number) => Self::Integer(number),
            Value::Real(number) => Self::Real(number),
            Value::Text(text) => Self::Text(text),
        }
    }
}

impl From<&SnapshotValue> for Value {
    fn from(value: &SnapshotValue) -> Self {
        match value {
            SnapshotValue::Null => Value::Null,
            SnapshotValue::Bool(flag) => Value::Integer(i64::from(*flag)),
            SnapshotValue::Integer(number) => Value::Integer(*number),
            SnapshotValue::Real(number) => Value::Real(*number),
            SnapshotValue::Text(text) => Value::Text(text.clone()),
        }
    }
}

/// Rows of one table: column names and, per row, the values in that order.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct SnapshotRows {
    pub table: String,
    pub columns: Vec<String>,
    pub values: Vec<Vec<SnapshotValue>>,
}

/// Tasks with every sub-task, their blocks, phase notes, dependencies and
/// the entries and ritual runs linked to them, as they were when captured.
/// The client keeps it and sends it back as the `restoreTasks` mutation, so
/// its JSON is the contract with the server: `created` holds
/// `[id, createdAt]`, `dependencies` `[taskId, blockedById]` and `links`
/// `[table, id, taskId]`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct TaskSnapshot {
    pub tasks: SnapshotRows,
    pub created: Vec<(Id, i64)>,
    pub copies: Vec<SnapshotRows>,
    pub dependencies: Vec<(Id, Id)>,
    pub links: Vec<(String, Id, Id)>,
}

fn sql_list(ids: &[Id]) -> String {
    ids.iter()
        .map(|id| format!("'{}'", id.as_str().replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(",")
}

fn read(conn: &Connection, table: &str, filter: &str) -> Result<SnapshotRows> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table} WHERE {filter} ORDER BY id"))?;
    let columns: Vec<String> = stmt.column_names().map(str::to_owned).collect();
    let width = columns.len();
    let values = stmt
        .query_map([], |row| {
            (0..width)
                .map(|index| row.get::<_, Value>(index).map(SnapshotValue::from))
                .collect()
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(SnapshotRows {
        table: table.to_owned(),
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

    let tasks = read(conn, TASK_TABLE, &format!("id IN ({list})"))?;
    let created = conn
        .prepare(&format!(
            "SELECT id, created_at FROM task WHERE id IN ({list}) ORDER BY id"
        ))?
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
             WHERE task_id IN ({list}) OR blocked_by_id IN ({list})
             ORDER BY task_id, blocked_by_id"
        ),
        |task, blocker| (task, blocker),
    )?;
    let mut links = Vec::new();
    for table in LINKED_TABLES {
        links.extend(pairs(
            conn,
            &format!("SELECT id, task_id FROM {table} WHERE task_id IN ({list}) ORDER BY id"),
            |row, task| (table.to_owned(), row, task),
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

fn local_columns(conn: &Connection, table: &str) -> Result<HashSet<String>> {
    Ok(conn
        .prepare("SELECT name FROM pragma_table_info(?1)")?
        .query_map(params![table], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?)
}

/// A captured row as `(column, value)` pairs this database has, with an
/// `id` drawn from `env` when the snapshot left it out.
type Row = Vec<(String, Value)>;

fn known_rows(conn: &Connection, env: &dyn MutationEnv, rows: &SnapshotRows) -> Result<Vec<Row>> {
    let known = local_columns(conn, &rows.table)?;
    let has_id = rows.columns.iter().any(|column| column == "id");
    rows.values
        .iter()
        .map(|values| {
            if values.len() != rows.columns.len() {
                return Err(Error::invalid(NOT_A_SNAPSHOT));
            }
            let mut row: Row = rows
                .columns
                .iter()
                .zip(values)
                .filter(|(column, _)| known.contains(column.as_str()))
                .map(|(column, value)| (column.clone(), Value::from(value)))
                .collect();
            if !has_id && known.contains("id") {
                row.push(("id".to_owned(), Value::Text(env.next_id().to_string())));
            }
            Ok(row)
        })
        .collect()
}

fn text(row: &Row, column: &str) -> Option<String> {
    row.iter().find_map(|(name, value)| match value {
        Value::Text(text) if name == column => Some(text.clone()),
        _ => None,
    })
}

fn parents_first(rows: Vec<Row>) -> Vec<Row> {
    let mut pending = rows;
    let mut ordered = Vec::with_capacity(pending.len());
    while !pending.is_empty() {
        let waiting: HashSet<String> = pending.iter().filter_map(|row| text(row, "id")).collect();
        let (ready, rest): (Vec<Row>, Vec<Row>) = pending.into_iter().partition(|row| {
            text(row, "parent_id").is_none_or(|parent| !waiting.contains(&parent))
        });
        if ready.is_empty() {
            ordered.extend(rest);
            break;
        }
        ordered.extend(ready);
        pending = rest;
    }
    ordered
}

fn write(conn: &Connection, table: &str, row: &Row, upsert: bool) -> Result<()> {
    let columns = row
        .iter()
        .map(|(name, _)| format!("\"{name}\""))
        .collect::<Vec<_>>();
    let slots = vec!["?"; columns.len()].join(", ");
    let conflict = if upsert {
        let updates = columns
            .iter()
            .filter(|column| column.as_str() != "\"id\"")
            .map(|column| format!("{column} = excluded.{column}"))
            .collect::<Vec<_>>()
            .join(", ");
        format!("ON CONFLICT (id) DO UPDATE SET {updates}")
    } else {
        "ON CONFLICT DO NOTHING".to_owned()
    };
    conn.execute(
        &format!(
            "INSERT INTO {table} ({}) VALUES ({slots}) {conflict}",
            columns.join(", ")
        ),
        params_from_iter(row.iter().map(|(_, value)| value)),
    )
    .map_err(|error| match error {
        rusqlite::Error::SqliteFailure(failure, _)
            if failure.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY =>
        {
            Error::invalid(GONE)
        }
        other => other.into(),
    })?;
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

fn owned_by_snapshot(row: &Row, column: &str, ids: &HashSet<String>) -> Result<()> {
    match text(row, column) {
        Some(task) if ids.contains(&task) => Ok(()),
        _ => Err(Error::invalid(NOT_A_SNAPSHOT)),
    }
}

/// Puts the captured rows back inside the caller's transaction, relinking
/// entries and runs that lost their task. Refuses rows that aren't the
/// snapshot's tasks, and a restore whose project or section is gone.
pub fn restore(conn: &Connection, env: &dyn MutationEnv, snapshot: &TaskSnapshot) -> Result<()> {
    if snapshot.tasks.table != TASK_TABLE
        || snapshot
            .copies
            .iter()
            .any(|rows| !COPIED_TABLES.contains(&rows.table.as_str()))
    {
        return Err(Error::invalid(NOT_A_SNAPSHOT));
    }
    ensure_ids_are_free(conn, snapshot)?;
    let ids: HashSet<String> = snapshot
        .created
        .iter()
        .map(|(id, _)| id.to_string())
        .collect();

    let tasks = known_rows(conn, env, &snapshot.tasks)?;
    for row in parents_first(tasks) {
        owned_by_snapshot(&row, "id", &ids)?;
        write(conn, TASK_TABLE, &row, true)?;
    }
    for rows in &snapshot.copies {
        for row in known_rows(conn, env, rows)? {
            owned_by_snapshot(&row, "task_id", &ids)?;
            write(conn, &rows.table, &row, false)?;
        }
    }
    for (task, blocker) in &snapshot.dependencies {
        conn.execute(
            "INSERT OR IGNORE INTO task_dependency (id, task_id, blocked_by_id)
             SELECT ?1, ?2, ?3
             WHERE EXISTS (SELECT 1 FROM task WHERE id = ?2)
               AND EXISTS (SELECT 1 FROM task WHERE id = ?3)",
            params![
                env.keyed_id(NaturalKey::TaskDependency(task, blocker)),
                task,
                blocker
            ],
        )?;
    }
    for (table, row, task) in &snapshot.links {
        if !LINKED_TABLES.contains(&table.as_str()) || !ids.contains(task.as_str()) {
            continue;
        }
        conn.execute(
            &format!("UPDATE {table} SET task_id = ?1 WHERE id = ?2 AND task_id IS NULL"),
            params![task, row],
        )?;
    }
    Ok(())
}
