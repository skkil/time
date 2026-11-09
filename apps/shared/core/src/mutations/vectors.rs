//! Replays `apps/shared/contract/src/mutation-vectors.json`, which the
//! server's `MutationVectorsTest` replays too: the same mutations with the
//! same clock and ids must leave the same rows on both sides.

use std::cell::RefCell;
use std::collections::VecDeque;

use chrono::{DateTime, FixedOffset};
use rusqlite::types::Value as SqlValue;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::{Map, Value};
use uuid::Uuid;

use super::apply;
use crate::db::Db;
use crate::env::MutationEnv;
use crate::types::Id;

const VECTORS: &str = include_str!("../../../contract/src/mutation-vectors.json");

struct Step {
    now: DateTime<FixedOffset>,
    ids: RefCell<VecDeque<Id>>,
    scope: Uuid,
}

impl MutationEnv for Step {
    fn now(&self) -> DateTime<FixedOffset> {
        self.now
    }

    fn next_id(&self) -> Id {
        self.ids
            .borrow_mut()
            .pop_front()
            .expect("the step draws more ids than it lists")
    }

    fn scope(&self) -> Option<Uuid> {
        Some(self.scope)
    }
}

fn row(conn: &Connection, table: &str, id: &str) -> Option<Map<String, Value>> {
    let mut stmt = conn
        .prepare(&format!("SELECT * FROM {table} WHERE id = ?1"))
        .unwrap();
    let columns: Vec<String> = stmt.column_names().map(str::to_owned).collect();
    stmt.query_row(params![id], |row| {
        Ok(columns
            .iter()
            .enumerate()
            .map(|(index, column)| {
                let value = match row.get::<_, SqlValue>(index).unwrap() {
                    SqlValue::Null | SqlValue::Blob(_) => Value::Null,
                    SqlValue::Integer(number) => Value::from(number),
                    SqlValue::Real(number) => Value::from(number),
                    SqlValue::Text(text) => Value::String(text),
                };
                (column.clone(), value)
            })
            .collect())
    })
    .optional()
    .unwrap()
}

/// `actual` as the vectors write it: SQLite's 0/1 as a boolean where one is
/// expected, integers as floats where a float is.
fn comparable(expected: &Value, actual: &Value) -> Value {
    match (expected, actual) {
        (Value::Bool(_), Value::Number(number)) => Value::Bool(number.as_i64() == Some(1)),
        (Value::Number(want), Value::Number(number)) if want.is_f64() => {
            Value::from(number.as_f64().unwrap())
        }
        _ => actual.clone(),
    }
}

#[test]
fn replaying_the_shared_vectors_leaves_the_expected_rows() {
    let vectors: Value = serde_json::from_str(VECTORS).unwrap();
    let scope = Uuid::parse_str(vectors["scope"].as_str().unwrap()).unwrap();
    let at = |step: &Value| {
        DateTime::parse_from_rfc3339(step["at"].as_str().or(vectors["at"].as_str()).unwrap())
            .unwrap()
    };
    let db = Db::in_memory().unwrap();
    let mut mismatches = Vec::new();
    db.call(|conn| {
        for (index, step) in vectors["steps"].as_array().unwrap().iter().enumerate() {
            let name = step["name"].as_str().unwrap();
            let label = format!("step {index} ({name})");
            let env = Step {
                now: at(step),
                ids: RefCell::new(
                    step["ids"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|id| Id::parse(id.as_str().unwrap()).unwrap())
                        .collect(),
                ),
                scope,
            };
            let tx = conn.transaction()?;
            apply(&tx, &env, name, &step["args"])
                .unwrap_or_else(|error| panic!("{label}: {error}"));
            tx.commit()?;
            assert!(
                env.ids.borrow().is_empty(),
                "{label} draws fewer ids than it lists"
            );
            for expected in step["expect"].as_array().unwrap() {
                let table = expected["table"].as_str().unwrap();
                let id = expected["id"].as_str().unwrap();
                let actual =
                    row(conn, table, id).unwrap_or_else(|| panic!("{label}: no {table} row {id}"));
                for (column, want) in expected["row"].as_object().unwrap() {
                    let got = actual
                        .get(column)
                        .unwrap_or_else(|| panic!("{label}: {table} has no {column}"));
                    if &comparable(want, got) != want {
                        mismatches.push(format!("{label}: {table}.{column} is {got}, not {want}"));
                    }
                }
            }
            for gone in step["gone"].as_array().into_iter().flatten() {
                let table = gone["table"].as_str().unwrap();
                let id = gone["id"].as_str().unwrap();
                if row(conn, table, id).is_some() {
                    mismatches.push(format!("{label}: {table} {id} is still there"));
                }
            }
        }
        Ok(())
    })
    .unwrap();
    assert!(mismatches.is_empty(), "{}", mismatches.join("\n"));
}
