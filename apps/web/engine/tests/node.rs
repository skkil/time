//! The handle in Node, over an in-memory database:
//! `cargo test` (needs `wasm-bindgen-test-runner` and Node).

#![cfg(target_arch = "wasm32")]

use js_sys::{Reflect, Uint8Array};
use serde_json::{Value, json};
use time_core_wasm::TimeCore;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::wasm_bindgen_test;

const SCOPE: &str = "0195f7a0-0000-7000-8000-000000000001";

fn field(value: &JsValue, name: &str) -> JsValue {
    Reflect::get(value, &JsValue::from_str(name)).unwrap()
}

fn json(text: &str) -> Value {
    serde_json::from_str(text).unwrap()
}

fn create_task(core: &mut TimeCore, title: &str) -> Value {
    json(
        &core
            .mutate(
                "createTask",
                &json!({ "input": {
                    "title": title, "notes": "", "projectId": null, "sectionId": null,
                    "parentId": null, "priority": 4, "dueDate": null, "dueTime": null,
                    "deadline": null, "recurrence": null, "estimateMinutes": null
                } })
                .to_string(),
            )
            .unwrap(),
    )
}

#[wasm_bindgen_test]
fn writes_and_reads_by_contract_name() {
    let mut core = TimeCore::open_in_memory().unwrap();
    let task = create_task(&mut core, "Write the plan");
    let read = json(
        &core
            .query("getTask", &json!({ "id": task["id"] }).to_string())
            .unwrap(),
    );
    assert_eq!(read["title"], "Write the plan");
    assert_eq!(
        json(&core.query("listTasks", "{}").unwrap())
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[wasm_bindgen_test]
fn errors_carry_the_apps_kind_and_message() {
    let mut core = TimeCore::open_in_memory().unwrap();
    let error = core
        .mutate(
            "createTask",
            &json!({ "input": { "title": "  " } }).to_string(),
        )
        .unwrap_err();
    assert_eq!(
        field(&error, "kind").as_string().as_deref(),
        Some("invalid")
    );
    assert!(field(&error, "message").as_string().is_some());

    let unknown = core.query("noSuchRead", "{}").unwrap_err();
    assert_eq!(
        field(&unknown, "kind").as_string().as_deref(),
        Some("invalid")
    );
}

#[wasm_bindgen_test]
fn an_unbound_database_queues_nothing_until_it_signs_in() {
    let mut core = TimeCore::open_in_memory().unwrap();
    create_task(&mut core, "Before sign-in");
    assert!(core.push_request(10).unwrap().is_none());
    assert_eq!(core.scope().unwrap(), None);

    let signed_in = core.bind_scope(SCOPE).unwrap();
    assert_eq!(
        field(&signed_in, "kind").as_string().as_deref(),
        Some("uploading")
    );
    assert_eq!(core.scope().unwrap().as_deref(), Some(SCOPE));

    create_task(&mut core, "After sign-in");
    let status = core.status().unwrap();
    assert_eq!(field(&status, "pending").as_f64(), Some(2.0));
    assert_eq!(
        field(&status, "scopeId").as_string().as_deref(),
        Some(SCOPE)
    );
    let push = core.push_request(10).unwrap().expect("a push request");
    assert!(!push.is_empty());
    assert!(!core.pull_request(100).unwrap().is_empty());

    let again = core.bind_scope(SCOPE).unwrap();
    assert_eq!(field(&again, "kind").as_string().as_deref(), Some("synced"));
    let other = core
        .bind_scope("0195f7a0-0000-7000-8000-000000000002")
        .unwrap();
    assert_eq!(
        field(&other, "kind").as_string().as_deref(),
        Some("otherAccount")
    );
}

#[wasm_bindgen_test]
fn forgetting_clears_the_account_and_its_rows() {
    let mut core = TimeCore::open_in_memory().unwrap();
    core.bind_scope(SCOPE).unwrap();
    create_task(&mut core, "Private");
    core.forget().unwrap();
    assert_eq!(core.scope().unwrap(), None);
    assert_eq!(json(&core.query("listTasks", "{}").unwrap()), json!([]));
}

#[wasm_bindgen_test]
fn a_backup_comes_back_through_import_local() {
    let mut source = TimeCore::open_in_memory().unwrap();
    create_task(&mut source, "Keep me");
    let backup = source.dump().unwrap();

    let mut target = TimeCore::open_in_memory().unwrap();
    target.bind_scope(SCOPE).unwrap();
    assert!(target.restore(&backup).unwrap() >= 1);
    let tasks = json(&target.query("listTasks", "{}").unwrap());
    assert_eq!(tasks[0]["title"], "Keep me");
    let status = target.status().unwrap();
    assert_eq!(field(&status, "pending").as_f64(), Some(1.0));

    let refused = target.restore("not a backup").unwrap_err();
    assert_eq!(
        field(&refused, "kind").as_string().as_deref(),
        Some("invalid")
    );
}

#[wasm_bindgen_test]
fn a_push_response_that_isnt_protobuf_is_refused() {
    let mut core = TimeCore::open_in_memory().unwrap();
    core.bind_scope(SCOPE).unwrap();
    let garbage = Uint8Array::from(&[0xff_u8, 0xff, 0xff][..]).to_vec();
    assert!(core.apply_push_response(&garbage).is_err());
    assert!(core.apply_pull_response(&garbage).is_err());
}

#[wasm_bindgen_test]
fn habits_sync_from_tracked_time_only() {
    let mut core = TimeCore::open_in_memory().unwrap();
    let report = core.sync_habits().unwrap();
    assert_eq!(
        field(&report, "activitywatch").as_string().as_deref(),
        Some("notNeeded")
    );
    assert!(core.issues().unwrap().is_array());
}
