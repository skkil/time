use std::collections::BTreeSet;

use rusqlite::Connection;
use serde_json::{Value, json};

use super::*;
use crate::device_settings;
use crate::error::Result;
use crate::mutations::apply;
use crate::rituals::ritual_id;
use crate::testing::{db, env, project_input, task_input};
use crate::types::Id;

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
        row.get(0)
    })
    .unwrap()
}

fn id(value: &Value) -> Id {
    Id::parse(value["id"].as_str().unwrap()).unwrap()
}

/// A project tree whose child row comes before its parent, a task with a
/// step, a rated day, a setting and a customised ritual.
fn fill(conn: &Connection) -> Result<()> {
    let env = env();
    let child = apply(
        conn,
        &env,
        "createProject",
        &json!({ "input": project_input("Copy", None) }),
    )?;
    let parent = apply(
        conn,
        &env,
        "createProject",
        &json!({ "input": project_input("Site", None) }),
    )?;
    apply(
        conn,
        &env,
        "updateProject",
        &json!({ "id": id(&child), "input": project_input("Copy", Some(&id(&parent))) }),
    )?;
    let task = apply(
        conn,
        &env,
        "createTask",
        &json!({ "input": task_input("Write", Some(&id(&parent))) }),
    )?;
    let mut step = task_input("Outline", None);
    step.parent_id = Some(id(&task));
    apply(conn, &env, "createTask", &json!({ "input": step }))?;
    apply(
        conn,
        &env,
        "rateDay",
        &json!({ "date": "2026-11-02", "felt": 4 }),
    )?;
    apply(
        conn,
        &env,
        "setRemindersEnabled",
        &json!({ "enabled": false }),
    )?;
    apply(
        conn,
        &env,
        "choosePlanningTime",
        &json!({ "time": "morning" }),
    )?;
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
        let mut expected: BTreeSet<String> =
            SYNCED_TABLES.iter().map(|t| (*t).to_owned()).collect();
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
            import(conn, &env(), &data)?;
            import(conn, &env(), &data)?;
            let scope = uuid::Uuid::from_u128(7);
            assert_eq!(
                dump(conn)?.with_seed_ids(scope),
                data.clone().with_seed_ids(scope)
            );
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
    let scope = uuid::Uuid::from_u128(42);
    let rekeyed = data.with_seed_ids(scope);
    let rituals = rekeyed.tables.iter().find(|t| t.table == "ritual").unwrap();
    for row in &rituals.rows {
        let kind = row["kind"].as_str().unwrap();
        assert_eq!(row["id"], ritual_id(scope, kind).as_str());
    }
    let days = rekeyed.tables.iter().find(|t| t.table == "day").unwrap();
    assert_eq!(
        days.rows[0]["id"],
        crate::env::NaturalKey::Day(crate::types::date("2026-11-02"))
            .id(scope)
            .as_str()
    );

    let strange = LocalData {
        tables: vec![TableRows {
            table: "device_setting".into(),
            rows: Vec::new(),
        }],
    };
    db().call(|conn| {
        assert!(import(conn, &env(), &strange).is_err());
        Ok(())
    })
    .unwrap();
}

struct Account(uuid::Uuid);

impl crate::env::MutationEnv for Account {
    fn now(&self) -> chrono::DateTime<chrono::FixedOffset> {
        crate::env::Clock::now(&crate::env::SystemClock)
    }

    fn next_id(&self) -> Id {
        Id::from(uuid::Uuid::now_v7())
    }

    fn scope(&self) -> Option<uuid::Uuid> {
        Some(self.0)
    }
}

fn rows(table: &str, rows: Vec<Value>) -> TableRows {
    TableRows {
        table: table.into(),
        rows: rows
            .into_iter()
            .map(|row| row.as_object().unwrap().clone())
            .collect(),
    }
}

fn column(conn: &Connection, sql: &str) -> Vec<String> {
    conn.prepare(sql)
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

fn new_id() -> Id {
    Id::from(uuid::Uuid::now_v7())
}

#[test]
fn references_list_every_foreign_key_to_an_id() {
    db().call(|conn| {
        let mut found = BTreeSet::new();
        for table in SYNCED_TABLES {
            let mut stmt = conn.prepare(
                "SELECT \"table\", \"from\" FROM pragma_foreign_key_list(?1) WHERE \"to\" = 'id'",
            )?;
            let keys = stmt.query_map([table], |row| {
                Ok((
                    table.to_owned(),
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(0)?,
                ))
            })?;
            for key in keys {
                found.insert(key?);
            }
        }
        let listed: BTreeSet<(String, String, String)> = REFERENCES
            .iter()
            .map(|(table, column, target)| ((*table).into(), (*column).into(), (*target).into()))
            .collect();
        assert_eq!(found, listed);
        Ok(())
    })
    .unwrap();
}

#[test]
fn an_upload_merges_into_rows_that_hold_its_natural_keys() {
    db().call(|conn| {
        let env = env();
        let group = apply(conn, &env, "createGroup", &json!({ "name": "Home" }))?;
        let quarter = apply(
            conn,
            &env,
            "upsertQuarter",
            &json!({ "id": null, "label": "Q1", "startDate": "2026-01-05" }),
        )?;
        let place = apply(conn, &env, "createPlace", &json!({ "name": "Office" }))?;
        let (their_group, their_quarter, project, priority) =
            (new_id(), new_id(), new_id(), new_id());
        let (their_place, task) = (new_id(), new_id());
        let data = LocalData {
            tables: vec![
                rows(
                    "project_group",
                    vec![json!({ "id": their_group, "name": "home", "position": 3 })],
                ),
                rows(
                    "project",
                    vec![json!({ "id": project, "name": "Garden", "group_id": their_group })],
                ),
                rows(
                    "quarter",
                    vec![json!({ "id": their_quarter, "label": "Winter", "start_date": "2026-01-05" })],
                ),
                rows(
                    "priority",
                    vec![json!({ "id": priority, "quarter_id": their_quarter, "title": "Rest" })],
                ),
                rows(
                    "place",
                    vec![json!({ "id": their_place, "name": "OFFICE", "position": 2 })],
                ),
                rows(
                    "task",
                    vec![json!({ "id": task, "title": "Print", "created_at": 1, "place_id": their_place })],
                ),
            ],
        };
        import(conn, &env, &data)?;

        let group_id = group["id"].as_str().unwrap();
        assert_eq!(column(conn, "SELECT id FROM project_group"), [group_id]);
        assert_eq!(column(conn, "SELECT name FROM project_group"), ["home"]);
        assert_eq!(column(conn, "SELECT group_id FROM project"), [group_id]);
        assert_eq!(column(conn, "SELECT label FROM quarter"), ["Winter"]);
        assert_eq!(
            column(conn, "SELECT quarter_id FROM priority"),
            [quarter.as_str().unwrap()]
        );
        assert_eq!(column(conn, "SELECT id FROM priority"), [priority.as_str()]);
        let place_id = place["id"].as_str().unwrap();
        assert_eq!(column(conn, "SELECT id FROM place"), [place_id]);
        assert_eq!(column(conn, "SELECT place_id FROM task"), [place_id]);
        Ok(())
    })
    .unwrap();
}

#[test]
fn an_upload_names_natural_key_rows_by_the_account_and_refuses_dangling_references() {
    let scope = uuid::Uuid::from_u128(9);
    db().call(|conn| {
        let day = LocalData {
            tables: vec![rows(
                "day",
                vec![json!({ "id": new_id(), "date": "2026-11-02", "felt": 3 })],
            )],
        };
        import(conn, &Account(scope), &day)?;
        let expected = crate::env::NaturalKey::Day(crate::types::date("2026-11-02")).id(scope);
        assert_eq!(column(conn, "SELECT id FROM day"), [expected.as_str()]);

        let dangling = LocalData {
            tables: vec![rows(
                "task",
                vec![json!({ "id": new_id(), "title": "Orphan", "created_at": 1, "project_id": new_id() })],
            )],
        };
        let refused = import(conn, &Account(scope), &dangling).unwrap_err();
        assert_eq!(
            refused.to_string(),
            "A task row points at a project that isn't there."
        );
        let unnamed = LocalData {
            tables: vec![rows(
                "task",
                vec![json!({ "id": 7, "title": "Odd", "created_at": 1 })],
            )],
        };
        let refused = import(conn, &Account(scope), &unnamed).unwrap_err();
        assert_eq!(refused.to_string(), "A task row has no id.");
        Ok(())
    })
    .unwrap();
}

#[test]
fn rows_leaving_another_account_take_new_ids_that_their_references_follow() {
    let data = db()
        .call(|conn| {
            fill(conn)?;
            dump(conn)
        })
        .unwrap();
    let moved = data.clone().with_new_ids();
    let ids = |data: &LocalData| -> BTreeSet<String> {
        data.tables
            .iter()
            .flat_map(|table| table.rows.iter())
            .map(|row| row["id"].as_str().unwrap().to_owned())
            .collect()
    };
    assert!(ids(&data).is_disjoint(&ids(&moved)));
    db().call(|conn| {
        import(conn, &env(), &moved)?;
        let steps = column(
            conn,
            "SELECT parent_id FROM task WHERE parent_id IS NOT NULL",
        );
        assert_eq!(steps.len(), 1);
        assert!(ids(&moved).contains(&steps[0]));
        Ok(())
    })
    .unwrap();
}
