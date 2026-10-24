use std::collections::HashSet;

use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, params, params_from_iter};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};

use super::tables::{ID_COLUMN, SYNCED_TABLES};
use crate::env::SeedScope;
use crate::error::{Error, Result};
use crate::rituals::{DEFAULTS, ritual_id};

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

    /// Gives every ritual the seeded id it has in `scope`, so the upload
    /// lands on the rituals the account already has.
    pub fn with_seed_ids(mut self, scope: SeedScope) -> Self {
        for table in self.tables.iter_mut().filter(|table| table.table == "ritual") {
            for row in &mut table.rows {
                if let Some(kind) = row.get("kind").and_then(Value::as_str) {
                    let id = ritual_id(scope, kind);
                    row.insert(ID_COLUMN.to_owned(), Value::String(id.to_string()));
                }
            }
        }
        self
    }
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
    match table {
        "project" | "task" => Some("parent_id"),
        "outcome" => Some("carried_from"),
        _ => None,
    }
}

/// `rows` reordered so a row comes after the row it points at.
fn parents_first<'a>(table: &str, rows: &'a [Map<String, Value>]) -> Vec<&'a Map<String, Value>> {
    let Some(column) = self_reference(table) else {
        return rows.iter().collect();
    };
    let id = |row: &Map<String, Value>| row.get(ID_COLUMN).and_then(Value::as_str).map(str::to_owned);
    let mut placed: HashSet<String> = HashSet::new();
    let present: HashSet<String> = rows.iter().filter_map(|row| id(row)).collect();
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
        placed.extend(ready.iter().filter_map(|row| id(row)));
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

fn upsert(conn: &Connection, table: &str, row: &[(&String, &Value)]) -> Result<()> {
    let columns: Vec<String> = row.iter().map(|(name, _)| format!("\"{name}\"")).collect();
    let slots = vec!["?"; columns.len()].join(", ");
    let updates = columns
        .iter()
        .filter(|column| column.as_str() != "\"id\"")
        .map(|column| format!("{column} = excluded.{column}"))
        .collect::<Vec<_>>()
        .join(", ");
    conn.execute(
        &format!(
            "INSERT INTO {table} ({}) VALUES ({slots}) ON CONFLICT DO UPDATE SET {updates}",
            columns.join(", ")
        ),
        params_from_iter(row.iter().map(|(_, value)| to_sql(value))),
    )?;
    Ok(())
}

/// `importLocal`: writes an uploaded copy of a device's rows, parents
/// first. A row whose id or natural key (a date, a setting key, a ritual
/// kind) already exists takes the uploaded values. Columns this database
/// doesn't have are ignored; tables it doesn't sync are refused.
pub fn import(conn: &Connection, data: &LocalData) -> Result<()> {
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
    for table in SYNCED_TABLES {
        let known = local_columns(conn, table)?;
        for rows in data.tables.iter().filter(|rows| rows.table == table) {
            for row in parents_first(table, &rows.rows) {
                if !row.get(ID_COLUMN).is_some_and(Value::is_string) {
                    return Err(Error::invalid(format!("A {table} row has no id.")));
                }
                let fields: Vec<(&String, &Value)> = row
                    .iter()
                    .filter(|(column, _)| known.contains(column.as_str()))
                    .collect();
                upsert(conn, table, &fields)?;
            }
        }
    }
    Ok(())
}
