use std::collections::BTreeSet;

use rusqlite::Connection;
use rusqlite::types::Value;

use super::migrate::migrate_to;
use super::*;
use crate::types::Id;

const BEFORE_UUIDS: usize = UUID_IDS_VERSION - 1;
const BEFORE_SYNC_IDS: usize = 18;
const BEFORE_REVIEW_POSITION: usize = 19;
const BEFORE_WEEKLY_CHECKOUT: usize = 22;
const BEFORE_ROLLOVER_DROP: usize = 24;
const BEFORE_SOMEDAY_DROP: usize = 25;

#[test]
fn migrates_m0_data_forward() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate_to(&mut conn, 1).unwrap();
    conn.execute_batch(
        "INSERT INTO project (name) VALUES ('Thesis');
         INSERT INTO focus (project_id, started_at, ended_at, note) VALUES (1, 100, 700, 'draft');
         INSERT INTO day (date, felt, plan_morning) VALUES ('2026-11-02', 4, 'write');",
    )
    .unwrap();

    migrate(&mut conn).unwrap();

    let entry: (String, i64) = conn
        .query_row(
            "SELECT e.description, e.ended_at - e.started_at
               FROM time_entry e JOIN project p ON p.id = e.project_id
              WHERE p.name = 'Thesis'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(entry, ("draft".into(), 600));

    let parent: Option<String> = conn
        .query_row("SELECT parent_id FROM project", [], |row| row.get(0))
        .unwrap();
    assert_eq!(parent, None);

    let felt: i64 = conn
        .query_row("SELECT felt FROM day", [], |row| row.get(0))
        .unwrap();
    assert_eq!(felt, 4);
}

const REALISTIC_DATA: &str = "
INSERT INTO project_group (id, name, position) VALUES (1, 'Acme', 1), (2, 'Home', 2);
INSERT INTO project (id, parent_id, name, color, position, group_id, external_id)
VALUES (1, NULL, 'Website', 'blue', 1, 1, 'todoist-1'),
       (2, 1, 'Landing page', 'teal', 2, NULL, NULL),
       (3, NULL, 'Garden', 'green', 3, 2, NULL),
       (4, 2, 'Copy', 'rust', 4, NULL, NULL);
INSERT INTO section (id, project_id, name, position) VALUES (1, 1, 'Doing', 1), (2, NULL, 'Inbox later', 1);
INSERT INTO quarter (id, label, start_date) VALUES (1, '2026 Q4', '2026-09-28');
INSERT INTO priority (id, quarter_id, title, note) VALUES (1, 1, 'Ship the site', ''), (2, 1, 'Rest', 'more');
INSERT INTO week (start_date, felt) VALUES ('2026-10-26', 3), ('2026-11-02', NULL);
INSERT INTO outcome (id, week_start, priority_id, title, status, carried_from)
VALUES (1, '2026-10-26', 1, 'Beta out', 'carried', NULL),
       (2, '2026-11-02', 1, 'Beta out', 'open', 1),
       (3, '2026-11-02', NULL, 'Sleep', 'open', NULL);
INSERT INTO item_type (id, project_id, name, icon, kind, position)
VALUES (1, 1, 'Bug', 'bug', 'task', 0), (2, 1, 'Meeting', 'users', 'event', 1),
       (3, 3, 'Lead', 'target', 'record', 0);
INSERT INTO item_status (id, project_id, name, category, position)
VALUES (1, 1, 'Todo', 'todo', 0), (2, 1, 'Done', 'done', 1), (3, 3, 'Applied', 'todo', 0);
INSERT INTO milestone (id, project_id, name, date, position) VALUES (1, 1, 'v1', '2026-12-01', 0);
INSERT INTO saved_view (id, project_id, name, layout, group_by, filter, sort, position)
VALUES (1, 1, 'Bugs', 'list', 'none', '{\"typeIds\":[1,2],\"hideDone\":true}', 'manual', 0),
       (2, 1, 'Board', 'board', 'status', '{}', 'manual', 1);
INSERT INTO task (id, title, project_id, section_id, parent_id, created_at, outcome_id, type_id,
                  status_id, milestone_id, position, external_id)
VALUES (1, 'Fix login', 1, 1, NULL, 100, 2, 1, 1, 1, 1, 'todoist-9'),
       (2, 'Reproduce', 1, 1, 1, 101, 2, NULL, 2, NULL, 1, NULL),
       (3, 'Inbox thought', NULL, NULL, NULL, 102, NULL, NULL, NULL, NULL, 2, NULL),
       (4, 'Acme application', 3, NULL, NULL, 103, NULL, 3, 3, NULL, 3, NULL),
       (5, 'Write cover letter', 3, NULL, 4, 104, NULL, NULL, NULL, NULL, 1, NULL);
UPDATE task SET phase_id = 3 WHERE id = 5;
INSERT INTO time_block (id, task_id, start_at, end_at) VALUES (1, 1, 3600, 7200), (2, 3, 7200, 9000);
INSERT INTO time_entry (id, description, project_id, task_id, started_at, ended_at)
VALUES (1, 'debugging', 1, 1, 100, 700), (2, 'reading', 3, NULL, 800, 900),
       (3, 'loose', NULL, NULL, 1000, 1100);
INSERT INTO habit (id, name, kind, track_source, track_project_id, start_date)
VALUES (1, 'Study', 'build', 'project', 3, '2026-10-01'), (2, 'Water', 'build', NULL, NULL, '2026-10-01');
INSERT INTO habit_log (habit_id, date, status, value, source)
VALUES (1, '2026-11-01', NULL, 30, 'auto'), (2, '2026-11-01', 'done', 1, 'manual');
INSERT INTO ritual_run (id, kind, date, task_id, started_at) VALUES (1, 'session', '2026-11-01', 1, 500),
       (2, 'morning', '2026-11-02', NULL, 600);
INSERT INTO running_timer (id, description, project_id, task_id, started_at) VALUES (1, 'focus', 1, 2, 900);
INSERT INTO task_dependency (task_id, blocked_by_id) VALUES (1, 3), (5, 1);
INSERT INTO record_phase (task_id, status_id, notes) VALUES (4, 3, 'Sent via referral');
INSERT INTO project_canvas (project_id, content, updated_at) VALUES (1, '<p>Plan</p>', 50);
INSERT INTO day (date, felt) VALUES ('2026-11-01', 4);
INSERT INTO setting (key, value) VALUES ('planning_time', 'morning');
";

const RELATIONS: &[&str] = &[
    "SELECT c.name, p.name FROM project c LEFT JOIN project p ON p.id = c.parent_id",
    "SELECT p.name, g.name FROM project p LEFT JOIN project_group g ON g.id = p.group_id",
    "SELECT s.name, p.name FROM section s LEFT JOIN project p ON p.id = s.project_id",
    "SELECT r.title, q.label FROM priority r JOIN quarter q ON q.id = r.quarter_id",
    "SELECT o.title, o.week_start, r.title, f.week_start FROM outcome o
       LEFT JOIN priority r ON r.id = o.priority_id LEFT JOIN outcome f ON f.id = o.carried_from",
    "SELECT t.name, p.name FROM item_type t JOIN project p ON p.id = t.project_id",
    "SELECT s.name, p.name FROM item_status s JOIN project p ON p.id = s.project_id",
    "SELECT m.name, p.name FROM milestone m JOIN project p ON p.id = m.project_id",
    "SELECT v.name, p.name FROM saved_view v JOIN project p ON p.id = v.project_id",
    "SELECT t.title, p.name, s.name, parent.title, o.title, ty.name, st.name, m.name, ph.name
       FROM task t
       LEFT JOIN project p ON p.id = t.project_id
       LEFT JOIN section s ON s.id = t.section_id
       LEFT JOIN task parent ON parent.id = t.parent_id
       LEFT JOIN outcome o ON o.id = t.outcome_id
       LEFT JOIN item_type ty ON ty.id = t.type_id
       LEFT JOIN item_status st ON st.id = t.status_id
       LEFT JOIN milestone m ON m.id = t.milestone_id
       LEFT JOIN item_status ph ON ph.id = t.phase_id",
    "SELECT b.start_at, t.title FROM time_block b JOIN task t ON t.id = b.task_id",
    "SELECT e.description, p.name, t.title FROM time_entry e
       LEFT JOIN project p ON p.id = e.project_id LEFT JOIN task t ON t.id = e.task_id",
    "SELECT h.name, p.name FROM habit h LEFT JOIN project p ON p.id = h.track_project_id",
    "SELECT h.name, l.date, l.value FROM habit_log l JOIN habit h ON h.id = l.habit_id",
    "SELECT r.kind, r.date, t.title FROM ritual_run r LEFT JOIN task t ON t.id = r.task_id",
    "SELECT r.description, p.name, t.title FROM running_timer r
       LEFT JOIN project p ON p.id = r.project_id LEFT JOIN task t ON t.id = r.task_id",
    "SELECT t.title, b.title FROM task_dependency d
       JOIN task t ON t.id = d.task_id JOIN task b ON b.id = d.blocked_by_id",
    "SELECT t.title, s.name, r.notes FROM record_phase r
       JOIN task t ON t.id = r.task_id JOIN item_status s ON s.id = r.status_id",
    "SELECT p.name, c.content FROM project_canvas c JOIN project p ON p.id = c.project_id",
    "SELECT date, felt FROM day",
    "SELECT key, value FROM setting",
];

const CREATION_ORDER: &[(&str, &str)] = &[
    ("project_group", "name"),
    ("project", "name"),
    ("section", "name"),
    ("quarter", "label"),
    ("priority", "title"),
    ("outcome", "title || week_start"),
    ("item_type", "name"),
    ("item_status", "name"),
    ("milestone", "name"),
    ("saved_view", "name"),
    ("task", "title"),
    ("time_block", "start_at"),
    ("time_entry", "description"),
    ("habit", "name"),
    ("ritual_run", "kind || date"),
];

fn ordered(conn: &Connection, table: &str, key: &str) -> Vec<String> {
    conn.prepare(&format!(
        "SELECT CAST({key} AS TEXT) FROM {table} ORDER BY id"
    ))
    .unwrap()
    .query_map([], |row| row.get(0))
    .unwrap()
    .collect::<rusqlite::Result<_>>()
    .unwrap()
}

fn rows(conn: &Connection, sql: &str) -> BTreeSet<String> {
    let mut stmt = conn.prepare(sql).unwrap();
    let width = stmt.column_count();
    stmt.query_map([], |row| {
        let values: Vec<Value> = (0..width)
            .map(|i| row.get(i))
            .collect::<rusqlite::Result<_>>()?;
        Ok(format!("{values:?}"))
    })
    .unwrap()
    .collect::<rusqlite::Result<_>>()
    .unwrap()
}

fn names(conn: &Connection, kind: &str) -> BTreeSet<String> {
    rows(
        conn,
        &format!(
            "SELECT name FROM sqlite_master WHERE type = '{kind}' AND name NOT LIKE 'sqlite_%'"
        ),
    )
}

#[test]
fn integer_ids_become_ordered_uuids_and_every_reference_follows() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate_to(&mut conn, BEFORE_UUIDS).unwrap();
    conn.execute_batch(REALISTIC_DATA).unwrap();
    let before: Vec<_> = RELATIONS.iter().map(|sql| rows(&conn, sql)).collect();
    let tables = names(&conn, "table");
    let indexes = names(&conn, "index");
    let order: Vec<_> = CREATION_ORDER
        .iter()
        .map(|(table, key)| ordered(&conn, table, key))
        .collect();

    migrate_to(&mut conn, UUID_IDS_VERSION).unwrap();

    let after: Vec<_> = RELATIONS.iter().map(|sql| rows(&conn, sql)).collect();
    for (sql, (before, after)) in RELATIONS.iter().zip(before.iter().zip(&after)) {
        assert_eq!(before, after, "{sql}");
    }
    assert_eq!(names(&conn, "table"), tables);
    assert_eq!(names(&conn, "index"), indexes);
    assert_eq!(CREATION_ORDER.len(), uuid_ids::ENTITY_TABLES.len());
    for ((table, key), before) in CREATION_ORDER.iter().zip(order) {
        assert_eq!(
            ordered(&conn, table, key),
            before,
            "{table} keeps creation order"
        );
        let ids = ordered(&conn, table, "id");
        assert!(ids.iter().all(|id| Id::parse(id).is_ok()), "{table}");
    }

    let filter: String = conn
        .query_row(
            "SELECT filter FROM saved_view WHERE name = 'Bugs'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let types: Vec<String> = conn
        .prepare("SELECT id FROM item_type WHERE project_id = (SELECT id FROM project WHERE name = 'Website') ORDER BY position")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();
    let filter: serde_json::Value = serde_json::from_str(&filter).unwrap();
    assert_eq!(filter["typeIds"], serde_json::json!(types));
    assert_eq!(filter["hideDone"], serde_json::json!(true));

    let violations: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(violations, 0);
    conn.execute("DELETE FROM project WHERE name = 'Website'", [])
        .unwrap();
    let left: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM task WHERE title = 'Reproduce'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(left, 0, "cascades still reach sub-tasks");
}

#[test]
fn a_fresh_database_starts_on_uuids() {
    let db = Db::in_memory().unwrap();
    db.call(|conn| {
        assert_eq!(schema_version(conn)?, latest_version());
        let id_type: String = conn.query_row(
            "SELECT type FROM pragma_table_info('task') WHERE name = 'id'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(id_type, "TEXT");
        Ok(())
    })
    .unwrap();
}

#[test]
fn keyed_rows_get_ids_and_device_settings_move_out() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate_to(&mut conn, BEFORE_SYNC_IDS).unwrap();
    conn.execute_batch(
        "INSERT INTO week (start_date) VALUES ('2026-11-02');
         INSERT INTO day (date, felt) VALUES ('2026-11-03', 4);
         INSERT INTO setting (key, value) VALUES ('capture_hotkey', 'off'), ('reminders_enabled', 'off');
         INSERT INTO running_timer (id, description, started_at) VALUES (1, 'Focus', 100);",
    )
    .unwrap();

    migrate(&mut conn).unwrap();

    for table in KEYED_TABLES.iter().chain(&["ritual", "running_timer"]) {
        let missing: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id IS NULL"),
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(missing, 0, "{table}");
    }
    let week: String = conn
        .query_row("SELECT id FROM week", [], |row| row.get(0))
        .unwrap();
    assert!(Id::parse(&week).is_ok());
    let morning: String = conn
        .query_row("SELECT id FROM ritual WHERE kind = 'morning'", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert!(Id::parse(&morning).is_ok());
    let timer: (String, String) = conn
        .query_row("SELECT id, description FROM running_timer", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .unwrap();
    assert!(Id::parse(&timer.0).is_ok());
    assert_eq!(timer.1, "Focus");
    let settings = rows(&conn, "SELECT key FROM setting");
    assert_eq!(
        settings,
        BTreeSet::from(["[Text(\"reminders_enabled\")]".to_owned()])
    );
    let device = rows(&conn, "SELECT key, value FROM device_setting");
    assert_eq!(
        device,
        BTreeSet::from(["[Text(\"capture_hotkey\"), Text(\"off\")]".to_owned()])
    );
}

#[test]
fn outcomes_and_priorities_take_positions_in_creation_order() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate_to(&mut conn, BEFORE_REVIEW_POSITION).unwrap();
    conn.execute_batch(
        "INSERT INTO quarter (id, label, start_date) VALUES ('q', 'Q4', '2026-10-05');
         INSERT INTO priority (id, quarter_id, title, created_at)
         VALUES ('a', 'q', 'Later', 20), ('b', 'q', 'First', 10);
         INSERT INTO week (id, start_date) VALUES ('w1', '2026-11-02'), ('w2', '2026-11-09');
         INSERT INTO outcome (id, week_start, priority_id, title, created_at)
         VALUES ('x', '2026-11-02', 'a', 'Second', 5), ('y', '2026-11-02', NULL, 'First', 1),
                ('z', '2026-11-09', 'b', 'Only', 9);",
    )
    .unwrap();

    migrate(&mut conn).unwrap();

    let positions = |table: &str| -> Vec<(String, i64)> {
        conn.prepare(&format!("SELECT id, position FROM {table} ORDER BY id"))
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    };
    let owned = |rows: &[(&str, i64)]| -> Vec<(String, i64)> {
        rows.iter().map(|(id, n)| ((*id).to_owned(), *n)).collect()
    };
    assert_eq!(positions("priority"), owned(&[("a", 2), ("b", 1)]));
    assert_eq!(positions("outcome"), owned(&[("x", 2), ("y", 1), ("z", 1)]));
    let created_at: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('outcome') WHERE name = 'created_at'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(created_at, 0);
}

#[test]
fn the_weekly_ritual_stops_opening_by_itself_unless_it_was_changed() {
    let trigger_after = |before: &str| -> String {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate_to(&mut conn, BEFORE_WEEKLY_CHECKOUT).unwrap();
        conn.execute(
            "UPDATE ritual SET trigger = ?1 WHERE kind = 'weekly'",
            [before],
        )
        .unwrap();
        migrate(&mut conn).unwrap();
        conn.query_row(
            "SELECT trigger FROM ritual WHERE kind = 'weekly'",
            [],
            |row| row.get(0),
        )
        .unwrap()
    };
    assert_eq!(trigger_after("first_open"), "manual");
    assert_eq!(trigger_after("at_time"), "at_time");
}

#[test]
fn the_moved_count_goes_even_while_store_watches_the_task_table() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate_to(&mut conn, BEFORE_ROLLOVER_DROP).unwrap();
    store_core::install(&conn).unwrap();
    store_core::register_table(&conn, "task", crate::data::ID_COLUMN).unwrap();

    migrate(&mut conn).unwrap();

    let columns: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('task') WHERE name = 'rollover_count'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(columns, 0);
}

#[test]
fn someday_goes_even_while_store_watches_the_task_table() {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate_to(&mut conn, BEFORE_SOMEDAY_DROP).unwrap();
    store_core::install(&conn).unwrap();
    store_core::register_table(&conn, "task", crate::data::ID_COLUMN).unwrap();

    migrate(&mut conn).unwrap();

    let columns: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('task') WHERE name = 'someday'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(columns, 0);
}
