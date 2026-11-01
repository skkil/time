use std::collections::{HashMap, HashSet};

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};

use super::tables::{ID_COLUMN, NATURAL_KEYS, REFERENCES, SYNCED_TABLES};
use uuid::Uuid;

use crate::env::{MutationEnv, NaturalKey};
use crate::error::{Error, Result};
use crate::rituals::DEFAULTS;
use crate::types::{Date, Id};

/// The rows of one synced table, each as a JSON object keyed by column.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TableRows {
    pub table: String,
    pub rows: Vec<Map<String, Value>>,
}

/// A full copy of the synced rows on a device, parents before children:
/// the argument of the `importLocal` mutation that uploads a device's
/// history on its first sign-in.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct LocalData {
    pub tables: Vec<TableRows>,
}

impl LocalData {
    pub fn is_empty(&self) -> bool {
        self.tables.iter().all(|table| table.rows.is_empty())
    }

    pub fn rows(&self) -> usize {
        self.tables.iter().map(|table| table.rows.len()).sum()
    }

    /// Gives every row with a natural key (a ritual's kind, a week's start,
    /// a setting's key, …) the id it has in `scope`, so the upload lands on
    /// the rows the account already has. Nothing points at these ids.
    pub fn with_seed_ids(mut self, scope: Uuid) -> Self {
        for table in &mut self.tables {
            for row in &mut table.rows {
                if let Some(id) = keyed_id(&table.table, row, scope) {
                    row.insert(ID_COLUMN.to_owned(), Value::String(id.to_string()));
                }
            }
        }
        self
    }

    /// Gives every row a new id and points every reference at the new ids:
    /// rows that belonged to another account keep none of its ids, which
    /// the server refuses to overwrite. Natural-key rows take their account
    /// ids afterwards, from [`Self::with_seed_ids`].
    pub fn with_new_ids(mut self) -> Self {
        let mut renamed: HashMap<(String, String), String> = HashMap::new();
        for table in &mut self.tables {
            for row in &mut table.rows {
                if let Some(Value::String(old)) = row.get(ID_COLUMN) {
                    let new = Uuid::now_v7().to_string();
                    renamed.insert((table.table.clone(), old.clone()), new.clone());
                    row.insert(ID_COLUMN.to_owned(), Value::String(new));
                }
            }
        }
        for table in &mut self.tables {
            for row in &mut table.rows {
                for (_, column, target) in references_of(&table.table) {
                    if let Some(Value::String(old)) = row.get(*column)
                        && let Some(new) = renamed.get(&((*target).to_owned(), old.clone()))
                    {
                        row.insert((*column).to_owned(), Value::String(new.clone()));
                    }
                }
            }
        }
        self
    }
}

fn references_of(
    table: &str,
) -> impl Iterator<Item = &'static (&'static str, &'static str, &'static str)> {
    REFERENCES.iter().filter(move |(from, _, _)| *from == table)
}

fn keyed_id(table: &str, row: &Map<String, Value>, scope: Uuid) -> Option<Id> {
    let text = |column: &str| row.get(column).and_then(Value::as_str);
    let id = |column: &str| text(column).and_then(|value| Id::parse(value).ok());
    let date = |column: &str| {
        row.get(column)
            .and_then(|value| serde_json::from_value::<Date>(value.clone()).ok())
    };
    let key = match table {
        "ritual" => NaturalKey::Ritual(text("kind")?),
        "week" => NaturalKey::Week(date("start_date")?),
        "day" => NaturalKey::Day(date("date")?),
        "setting" => NaturalKey::Setting(text("key")?),
        "habit_log" => {
            return Some(NaturalKey::HabitLog(&id("habit_id")?, date("date")?).id(scope));
        }
        "project_canvas" => return Some(NaturalKey::ProjectCanvas(&id("project_id")?).id(scope)),
        "record_phase" => {
            return Some(NaturalKey::RecordPhase(&id("task_id")?, &id("status_id")?).id(scope));
        }
        "task_dependency" => {
            return Some(
                NaturalKey::TaskDependency(&id("task_id")?, &id("blocked_by_id")?).id(scope),
            );
        }
        "running_timer" => NaturalKey::RunningTimer,
        _ => return None,
    };
    Some(key.id(scope))
}

fn to_json(value: SqlValue) -> Value {
    match value {
        SqlValue::Null | SqlValue::Blob(_) => Value::Null,
        SqlValue::Integer(number) => Value::from(number),
        SqlValue::Real(number) => Number::from_f64(number).map_or(Value::Null, Value::Number),
        SqlValue::Text(text) => Value::String(text),
    }
}

fn to_sql(value: &Value) -> SqlValue {
    match value {
        Value::Null => SqlValue::Null,
        Value::Bool(flag) => SqlValue::Integer(i64::from(*flag)),
        Value::Number(number) => number
            .as_i64()
            .map(SqlValue::Integer)
            .or_else(|| number.as_f64().map(SqlValue::Real))
            .unwrap_or(SqlValue::Null),
        Value::String(text) => SqlValue::Text(text.clone()),
        other => SqlValue::Text(other.to_string()),
    }
}

fn at_default(row: &Map<String, Value>) -> bool {
    DEFAULTS.iter().any(|ritual| {
        row.get("kind").and_then(Value::as_str) == Some(ritual.kind)
            && row.get("enabled").and_then(Value::as_i64) == Some(i64::from(ritual.enabled))
            && row.get("trigger").and_then(Value::as_str) == Some(ritual.trigger)
            && row.get("at_minute").and_then(Value::as_i64) == Some(i64::from(ritual.at_minute))
            && row.get("weekdays").and_then(Value::as_i64) == Some(i64::from(ritual.weekdays))
            && row.get("steps").and_then(Value::as_str) == Some(ritual.steps)
    })
}

/// The column through which a table's rows point at other rows of it.
fn self_reference(table: &str) -> Option<&'static str> {
    references_of(table)
        .find(|(_, _, target)| *target == table)
        .map(|(_, column, _)| *column)
}

/// `rows` reordered so a row comes after the row it points at.
fn parents_first<'a>(table: &str, rows: &'a [Map<String, Value>]) -> Vec<&'a Map<String, Value>> {
    let Some(column) = self_reference(table) else {
        return rows.iter().collect();
    };
    let id = |row: &Map<String, Value>| {
        row.get(ID_COLUMN)
            .and_then(Value::as_str)
            .map(str::to_owned)
    };
    let mut placed: HashSet<String> = HashSet::new();
    let present: HashSet<String> = rows.iter().filter_map(&id).collect();
    let mut pending: Vec<&Map<String, Value>> = rows.iter().collect();
    let mut ordered = Vec::with_capacity(rows.len());
    while !pending.is_empty() {
        let (ready, waiting): (Vec<_>, Vec<_>) = pending.into_iter().partition(|row| {
            row.get(column)
                .and_then(Value::as_str)
                .is_none_or(|parent| !present.contains(parent) || placed.contains(parent))
        });
        if ready.is_empty() {
            ordered.extend(waiting);
            break;
        }
        placed.extend(ready.iter().copied().filter_map(id));
        ordered.extend(ready);
        pending = waiting;
    }
    ordered
}

fn read_table(conn: &Connection, table: &str) -> Result<Vec<Map<String, Value>>> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table} ORDER BY rowid"))?;
    let columns: Vec<String> = stmt.column_names().map(str::to_owned).collect();
    let rows = stmt.query_map([], |row| {
        columns
            .iter()
            .enumerate()
            .map(|(index, column)| Ok((column.clone(), to_json(row.get(index)?))))
            .collect::<rusqlite::Result<Map<String, Value>>>()
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Every synced row on this device. Rituals still at their defaults are
/// left out, so an upload never overrides an account's own settings.
pub fn dump(conn: &Connection) -> Result<LocalData> {
    let tables = SYNCED_TABLES
        .iter()
        .map(|table| {
            let mut rows = read_table(conn, table)?;
            if *table == "ritual" {
                rows.retain(|row| !at_default(row));
            }
            let rows = parents_first(table, &rows).into_iter().cloned().collect();
            Ok(TableRows {
                table: (*table).to_owned(),
                rows,
            })
        })
        .collect::<Result<_>>()?;
    Ok(LocalData { tables })
}

fn local_columns(conn: &Connection, table: &str) -> Result<HashSet<String>> {
    Ok(conn
        .prepare("SELECT name FROM pragma_table_info(?1)")?
        .query_map(params![table], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?)
}

fn exists(conn: &Connection, table: &str, id: &str) -> Result<bool> {
    Ok(conn
        .query_row(
            &format!("SELECT 1 FROM {table} WHERE id = ?1"),
            params![id],
            |_| Ok(()),
        )
        .optional()?
        .is_some())
}

/// The id of the row that already holds `row`'s natural key, if any.
fn holder(conn: &Connection, table: &str, row: &Map<String, Value>) -> Result<Option<String>> {
    let Some((_, columns)) = NATURAL_KEYS.iter().find(|(name, _)| *name == table) else {
        return Ok(None);
    };
    let values: Option<Vec<SqlValue>> = columns
        .iter()
        .map(|column| {
            row.get(*column)
                .filter(|value| !value.is_null())
                .map(to_sql)
        })
        .collect();
    let Some(values) = values else {
        return Ok(None);
    };
    let filter = columns
        .iter()
        .enumerate()
        .map(|(index, column)| format!(" AND \"{column}\" = ?{}", index + 1))
        .collect::<String>();
    Ok(conn
        .query_row(
            &format!("SELECT id FROM {table} WHERE 1 = 1{filter} LIMIT 1"),
            params_from_iter(values),
            |row| row.get(0),
        )
        .optional()?)
}

fn upsert(conn: &Connection, table: &str, row: &Map<String, Value>) -> Result<()> {
    let columns: Vec<String> = row.keys().map(|name| format!("\"{name}\"")).collect();
    let slots = vec!["?"; columns.len()].join(", ");
    let updates = columns
        .iter()
        .filter(|column| column.as_str() != "\"id\"")
        .map(|column| format!("{column} = excluded.{column}"))
        .collect::<Vec<_>>();
    let action = if updates.is_empty() {
        "NOTHING".to_owned()
    } else {
        format!("UPDATE SET {}", updates.join(", "))
    };
    conn.execute(
        &format!(
            "INSERT INTO {table} ({}) VALUES ({slots}) ON CONFLICT(id) DO {action}",
            columns.join(", ")
        ),
        params_from_iter(row.values().map(to_sql)),
    )?;
    Ok(())
}

/// `importLocal`: writes an uploaded copy of a device's rows into the
/// account, table by table in [`SYNCED_TABLES`] order and parents first.
///
/// - Tables that don't sync are refused, and so is a row without an id.
///   Columns this database doesn't have are ignored.
/// - In an account, a natural-key row (a ritual's kind, a day, a setting,
///   …) takes its key's id there, whatever id it arrived with.
/// - A row whose id exists takes the uploaded values. Otherwise a row whose
///   natural key ([`NATURAL_KEYS`]: a group's name, a quarter's start, an
///   imported row's external id, …) another row already holds merges into
///   that row: it keeps its id, takes the uploaded values, and every later
///   uploaded reference to the uploaded id follows it. Anything else is
///   inserted with the id the device chose.
/// - Every reference must name a row the account has, uploaded or not.
pub fn import(conn: &Connection, env: &dyn MutationEnv, data: &LocalData) -> Result<()> {
    if let Some(unknown) = data
        .tables
        .iter()
        .find(|rows| !SYNCED_TABLES.contains(&rows.table.as_str()))
    {
        return Err(Error::invalid(format!(
            "“{}” can't be imported.",
            unknown.table
        )));
    }
    let mut merged: HashMap<(&str, String), String> = HashMap::new();
    for table in SYNCED_TABLES {
        let known = local_columns(conn, table)?;
        for rows in data.tables.iter().filter(|rows| rows.table == table) {
            for uploaded in parents_first(table, &rows.rows) {
                let Some(sent) = uploaded
                    .get(ID_COLUMN)
                    .and_then(Value::as_str)
                    .and_then(|id| Id::parse(id).ok())
                else {
                    return Err(Error::invalid(format!("A {table} row has no id.")));
                };
                let mut row: Map<String, Value> = uploaded
                    .iter()
                    .filter(|(column, _)| known.contains(column.as_str()))
                    .map(|(column, value)| (column.clone(), value.clone()))
                    .collect();
                for (_, column, target) in references_of(table) {
                    let Some(Value::String(value)) = row.get(*column) else {
                        continue;
                    };
                    let value = merged
                        .get(&(*target, value.clone()))
                        .cloned()
                        .unwrap_or_else(|| value.clone());
                    if !exists(conn, target, &value)? {
                        return Err(Error::invalid(format!(
                            "A {table} row points at a {target} that isn't there."
                        )));
                    }
                    row.insert((*column).to_owned(), Value::String(value));
                }
                let mut id = env
                    .scope()
                    .and_then(|scope| keyed_id(table, &row, scope))
                    .unwrap_or_else(|| sent.clone())
                    .to_string();
                if !exists(conn, table, &id)?
                    && let Some(holder) = holder(conn, table, &row)?
                {
                    id = holder;
                }
                if id != sent.as_str() {
                    merged.insert((table, sent.to_string()), id.clone());
                }
                row.insert(ID_COLUMN.to_owned(), Value::String(id));
                upsert(conn, table, &row)?;
            }
        }
    }
    Ok(())
}
