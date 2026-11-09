use serde_json::json;

use super::server::FakeServer;
use super::{Device, comparable, project, task};
use crate::sync::{Engine, SignIn};

#[test]
fn two_devices_converge_through_the_server() {
    let mut server = FakeServer::new();
    let mut laptop = Device::signed_in(&mut server);
    let mut phone = Device::signed_in(&mut server);

    let thesis = laptop.id("createProject", json!({ "input": project("Thesis") }));
    let draft = laptop.id(
        "createTask",
        json!({ "input": task("Draft", Some(&thesis)) }),
    );
    laptop.run("rateDay", json!({ "date": "2026-11-02", "felt": 4 }));
    laptop.sync(&mut server);
    phone.sync(&mut server);
    assert_eq!(phone.titles(), ["Draft"]);

    phone.run(
        "setTaskCompleted",
        json!({ "id": draft, "completed": true }),
    );
    phone.run(
        "saveDayNote",
        json!({ "date": "2026-11-02", "note": "Calm" }),
    );
    phone.sync(&mut server);
    laptop.sync(&mut server);

    assert_eq!(laptop.data(), phone.data());
    assert_eq!(laptop.data(), comparable(server.data()));
    assert_eq!(laptop.engine.status().unwrap().pending, 0);
}

#[test]
fn a_refused_change_becomes_an_issue_and_disappears() {
    let mut server = FakeServer::new();
    let mut laptop = Device::signed_in(&mut server);
    let mut phone = Device::signed_in(&mut server);
    let garden = laptop.id("createProject", json!({ "input": project("Garden") }));
    laptop.sync(&mut server);
    phone.sync(&mut server);

    laptop.run("deleteProject", json!({ "id": garden }));
    phone.run(
        "createTask",
        json!({ "input": task("Plant bulbs", Some(&garden)) }),
    );
    assert_eq!(phone.titles(), ["Plant bulbs"]);
    laptop.sync(&mut server);
    phone.sync(&mut server);

    assert!(phone.titles().is_empty());
    let issues = phone.engine.issues().unwrap();
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].name, "createTask");
    assert_eq!(issues[0].subject.as_deref(), Some("Plant bulbs"));
    assert!(!issues[0].reason.is_empty());
    assert_eq!(phone.engine.status().unwrap().open_issues, 1);
    assert!(phone.engine.dismiss_issue(issues[0].id).unwrap());
    assert!(phone.engine.issues().unwrap().is_empty());
    assert_eq!(laptop.data(), phone.data());
}

#[test]
fn offline_edits_on_both_devices_converge() {
    let mut server = FakeServer::new();
    let mut laptop = Device::signed_in(&mut server);
    let mut phone = Device::signed_in(&mut server);
    let shared = laptop.id("createTask", json!({ "input": task("Shared", None) }));
    laptop.sync(&mut server);
    phone.sync(&mut server);

    laptop.run(
        "updateTask",
        json!({ "id": shared, "input": task("From laptop", None) }),
    );
    laptop.run("createTask", json!({ "input": task("Laptop only", None) }));
    phone.run(
        "updateTask",
        json!({ "id": shared, "input": task("From phone", None) }),
    );
    phone.run("createTask", json!({ "input": task("Phone only", None) }));
    phone.run(
        "saveWeekNotes",
        json!({
            "date": "2026-11-02", "notes": { "worked": "focus", "fellShort": "", "change": "" }
        }),
    );
    laptop.run("rateWeek", json!({ "date": "2026-11-02", "felt": 3 }));

    laptop.sync(&mut server);
    phone.sync(&mut server);
    laptop.sync(&mut server);

    assert_eq!(laptop.titles(), ["From phone", "Laptop only", "Phone only"]);
    assert_eq!(laptop.data(), phone.data());
    let week = laptop.read("getWeek", json!({ "date": "2026-11-02" }));
    assert_eq!(week["felt"], 3);
    assert_eq!(week["notes"]["worked"], "focus");
}

#[test]
fn the_running_timer_is_one_per_account() {
    let mut server = FakeServer::new();
    let mut laptop = Device::signed_in(&mut server);
    let mut phone = Device::signed_in(&mut server);

    laptop.run(
        "startTimer",
        json!({ "details": { "description": "Write", "projectId": null, "taskId": null } }),
    );
    laptop.sync(&mut server);
    phone.sync(&mut server);
    assert_eq!(phone.read("getTimer", json!({}))["description"], "Write");

    phone.run(
        "editTimer",
        json!({ "details": { "description": "Edit", "projectId": null, "taskId": null } }),
    );
    phone.run("discardTimer", json!({}));
    phone.sync(&mut server);
    laptop.sync(&mut server);
    assert!(laptop.read("getTimer", json!({})).is_null());

    phone.run(
        "startTimer",
        json!({ "details": { "description": "Again", "projectId": null, "taskId": null } }),
    );
    laptop.run(
        "startTimer",
        json!({ "details": { "description": "Mine", "projectId": null, "taskId": null } }),
    );
    phone.sync(&mut server);
    laptop.sync(&mut server);
    phone.sync(&mut server);
    assert_eq!(phone.read("getTimer", json!({}))["description"], "Mine");
    assert_eq!(laptop.data(), phone.data());
}

#[test]
fn undo_travels_as_a_restore_every_device_replays() {
    let mut server = FakeServer::new();
    let mut laptop = Device::signed_in(&mut server);
    let mut phone = Device::signed_in(&mut server);
    let parent = laptop.id("createTask", json!({ "input": task("Pack", None) }));
    let mut step = task("Socks", None);
    step["parentId"] = json!(parent);
    laptop.run("createTask", json!({ "input": step }));
    laptop.sync(&mut server);
    phone.sync(&mut server);

    let snapshot = laptop.read("captureTasks", json!({ "ids": [parent] }));
    laptop.run("deleteTask", json!({ "id": parent }));
    laptop.sync(&mut server);
    phone.sync(&mut server);
    assert!(phone.titles().is_empty());

    laptop.run("restoreTasks", json!({ "snapshot": snapshot }));
    laptop.sync(&mut server);
    phone.sync(&mut server);
    assert_eq!(phone.titles(), ["Pack", "Socks"]);
    assert_eq!(laptop.data(), phone.data());
}

#[test]
fn the_first_sign_in_uploads_what_the_device_already_had() {
    let mut server = FakeServer::new();
    let mut desk = Device::new();
    let home = desk.id("createProject", json!({ "input": project("Home") }));
    desk.run(
        "createTask",
        json!({ "input": task("Fix the tap", Some(&home)) }),
    );
    desk.run("rateDay", json!({ "date": "2026-11-02", "felt": 5 }));
    desk.run("choosePlanningTime", json!({ "time": "morning" }));
    desk.run("startRitual", json!({ "kind": "morning", "taskId": null }));
    assert_eq!(
        desk.engine.status().unwrap().pending,
        0,
        "nothing queues before sign-in"
    );

    let SignIn::Uploading { rows } = desk.engine.sign_in(server.scope).unwrap() else {
        panic!("the first sign-in uploads");
    };
    assert!(rows >= 5);
    assert_eq!(desk.engine.status().unwrap().pending, 1);
    assert_eq!(desk.titles(), ["Fix the tap"]);
    desk.sync(&mut server);
    assert_eq!(desk.engine.sign_in(server.scope).unwrap(), SignIn::Synced);

    let phone = Device::signed_in(&mut server);
    assert_eq!(phone.titles(), ["Fix the tap"]);
    assert_eq!(phone.read("getPlanningTime", json!({})), "morning");
    assert_eq!(desk.data(), phone.data());
    assert_eq!(desk.data(), comparable(server.data()));
}

#[test]
fn another_account_is_never_merged_silently() {
    let mut work = FakeServer::new();
    let mut home = FakeServer::new();
    let mut desk = Device::signed_in(&mut work);
    desk.run(
        "createTask",
        json!({ "input": task("Quarterly report", None) }),
    );
    desk.sync(&mut work);
    let mut other = Device::signed_in(&mut home);
    other.run("createTask", json!({ "input": task("Groceries", None) }));
    other.sync(&mut home);

    assert_eq!(
        desk.engine.sign_in(home.scope).unwrap(),
        SignIn::OtherAccount { bound: work.scope }
    );
    assert_eq!(desk.titles(), ["Quarterly report"]);

    desk.engine.start_fresh(home.scope).unwrap();
    assert!(desk.titles().is_empty());
    desk.sync(&mut home);
    assert_eq!(desk.titles(), ["Groceries"]);

    desk.engine.keep_local(work.scope).unwrap();
    desk.sync(&mut work);
    assert_eq!(desk.titles(), ["Groceries", "Quarterly report"]);
    assert_eq!(desk.data(), comparable(work.data()));
}

#[test]
fn an_interrupted_upload_finishes_on_the_next_open() {
    let path = std::env::temp_dir().join(format!("skkil-upload-{}.db", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let scope = store_core::uuid::Uuid::now_v7();
    {
        let mut engine = Engine::open(rusqlite::Connection::open(&path).unwrap()).unwrap();
        engine
            .mutate("createTask", &json!({ "input": task("Kept", None) }))
            .unwrap();
        let data = crate::data::dump(engine.connection())
            .unwrap()
            .with_seed_ids(scope);
        let staged = json!({ "scope": scope, "data": data }).to_string();
        crate::device_settings::write(engine.connection(), "sync_upload", &staged).unwrap();
        store_core::forget(engine.connection_mut()).unwrap();
    }
    let engine = Engine::open(rusqlite::Connection::open(&path).unwrap()).unwrap();
    assert_eq!(engine.scope().unwrap(), Some(scope));
    assert_eq!(engine.status().unwrap().pending, 1);
    let tasks = engine.query("listTasks", &json!({})).unwrap();
    assert_eq!(tasks[0]["title"], "Kept");
    drop(engine);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn a_refused_upload_comes_back_when_tried_again() {
    let mut server = FakeServer::new();
    let mut desk = Device::new();
    let home = desk.id("createProject", json!({ "input": project("Home") }));
    desk.run(
        "createTask",
        json!({ "input": task("Fix the tap", Some(&home)) }),
    );
    desk.run("rateDay", json!({ "date": "2026-11-02", "felt": 5 }));

    server.refuse_once("importLocal", "That id is already taken.");
    desk.engine.sign_in(server.scope).unwrap();
    desk.sync(&mut server);
    assert!(desk.titles().is_empty(), "store undoes a refused upload");
    let issues = desk.engine.issues().unwrap();
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].name, "importLocal");
    assert_eq!(issues[0].reason, "That id is already taken.");

    desk.engine.retry_issue(issues[0].id).unwrap();
    assert_eq!(desk.titles(), ["Fix the tap"]);
    assert!(desk.engine.issues().unwrap().is_empty());
    assert_eq!(desk.engine.status().unwrap().pending, 1);
    desk.sync(&mut server);

    assert_eq!(desk.engine.status().unwrap().pending, 0);
    assert!(desk.engine.issues().unwrap().is_empty());
    assert_eq!(desk.titles(), ["Fix the tap"]);
    assert_eq!(desk.data(), comparable(server.data()));
    let phone = Device::signed_in(&mut server);
    assert_eq!(phone.titles(), ["Fix the tap"]);
    assert_eq!(phone.data(), desk.data());
}

#[test]
fn retrying_an_unknown_issue_fails() {
    let mut server = FakeServer::new();
    let mut desk = Device::signed_in(&mut server);
    assert!(desk.engine.retry_issue(42).is_err());
}
