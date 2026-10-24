use std::collections::BTreeSet;

use rusqlite::Connection;
use serde_json::{Value, json};

use super::*;
use crate::device_settings;
use crate::env::SeedScope;
use crate::error::Result;
use crate::mutations::apply;
use crate::rituals::ritual_id;
use crate::testing::{db, env, project_input, task_input};
use crate::types::Id;

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
        .unwrap()
}

fn id(value: &Value) -> Id {
    Id::parse(value["id"].as_str().unwrap()).unwrap()
}

/// A project tree whose child row comes before its parent, a task with a
/// step, a rated day, a setting and a customised ritual.
fn fill(conn: &Connection) -> Result<()> {
    let env = env();
    let child = apply(conn, &env, "createProject", &json!({ "input": project_input("Copy", None) }))?;
    let parent = apply(conn, &env, "createProject", &json!({ "input": project_input("Site", None) }))?;
    apply(
        conn,
        &env,
        "updateProject",
        &json!({ "id": id(&child), "input": project_input("Copy", Some(&id(&parent))) }),
    )?;
    let task = apply(conn, &env, "createTask", &json!({ "input": task_input("Write", Some(&id(&parent))) }))?;
    let mut step = task_input("Outline", None);
    step.parent_id = Some(id(&task));
    apply(conn, &env, "createTask", &json!({ "input": step }))?;
    apply(conn, &env, "rateDay", &json!({ "date": "2026-11-02", "felt": 4 }))?;
    apply(conn, &env, "setRemindersEnabled", &json!({ "enabled": false }))?;
    apply(conn, &env, "choosePlanningTime", &json!({ "time": "morning" }))?;
    Ok(())
}

fn tables_of(conn: &Connection) -> BTreeSet<String> {
    conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

#[test]
fn every_table_either_syncs_or_belongs_to_the_device() {
    db().call(|conn| {
        let mut expected: BTreeSet<String> = SYNCED_TABLES.iter().map(|t| (*t).to_owned()).collect();
        expected.insert("device_setting".to_owned());
        assert_eq!(tables_of(conn), expected);
        for table in SYNCED_TABLES {
            let has_id: i64 = conn.query_row(
                "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = 'id'",
                [table],
                |row| row.get(0),
            )?;
            assert_eq!(has_id, 1, "{table} has an id column");
        }
        Ok(())
    })
    .unwrap();
}

#[test]
fn deleting_everything_keeps_the_rituals_at_their_defaults_and_device_settings() {
    db().call(|conn| {
        fill(conn)?;
        device_settings::set_switch(conn, "capture_hotkey", false)?;
        let rituals = count(conn, "ritual");

        delete_all(conn)?;

        for table in SYNCED_TABLES.iter().filter(|table| **table != "ritual") {
            assert_eq!(count(conn, table), 0, "{table}");
        }
        assert_eq!(count(conn, "ritual"), rituals);
        assert!(dump(conn)?.is_empty());
        assert!(!device_settings::switch_on(conn, "capture_hotkey")?);
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_dump_imports_into_an_empty_database_unchanged() {
    let (source, target) = (db(), db());
    let data = source
        .call(|conn| {
            fill(conn)?;
            dump(conn)
        })
        .unwrap();
    assert!(!data.is_empty());
    let rituals = data.tables.iter().find(|t| t.table == "ritual").unwrap();
    assert_eq!(rituals.rows.len(), 1, "only the customised ritual travels");

    let json = serde_json::to_value(&data).unwrap();
    let data: LocalData = serde_json::from_value(json).unwrap();
    target
        .call(|conn| {
            import(conn, &data)?;
            import(conn, &data)?;
            assert_eq!(dump(conn)?, data);
            Ok(())
        })
        .unwrap();
}

#[test]
fn imports_take_the_account_seed_ids_and_refuse_strange_tables() {
    let data = db()
        .call(|conn| {
            fill(conn)?;
            dump(conn)
        })
        .unwrap();
    let scope = SeedScope::Account(uuid::Uuid::from_u128(42));
    let rekeyed = data.with_seed_ids(scope);
    let rituals = rekeyed.tables.iter().find(|t| t.table == "ritual").unwrap();
    for row in &rituals.rows {
        let kind = row["kind"].as_str().unwrap();
        assert_eq!(row["id"], ritual_id(scope, kind).as_str());
    }

    let strange = LocalData {
        tables: vec![TableRows {
            table: "device_setting".into(),
            rows: Vec::new(),
        }],
    };
    db().call(|conn| {
        assert!(import(conn, &strange).is_err());
        Ok(())
    })
    .unwrap();
}
