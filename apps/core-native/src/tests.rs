use std::sync::Arc;

use pollster::block_on;
use prost::Message;
use serde_json::{Value, json};
use time_core::sync::protocol::v1::{PullRequest, PushRequest};

use crate::{CoreError, SignInOutcome, TimeCore, open};

const SCOPE: &str = "0193a5c0-0000-7000-8000-000000000001";
const OTHER: &str = "0193a5c0-0000-7000-8000-000000000002";

struct Fixture {
    core: Arc<TimeCore>,
    _dir: tempfile::TempDir,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("time.db").to_string_lossy().into_owned();
    Fixture {
        core: block_on(open(path)).unwrap(),
        _dir: dir,
    }
}

fn mutate(core: &TimeCore, name: &str, args: Value) -> Result<Value, CoreError> {
    block_on(core.mutate(name.into(), args.to_string()))
        .map(|result| serde_json::from_str(&result).unwrap())
}

fn query(core: &TimeCore, name: &str, args: Value) -> Result<Value, CoreError> {
    block_on(core.query(name.into(), args.to_string()))
        .map(|result| serde_json::from_str(&result).unwrap())
}

fn create_project(core: &TimeCore, name: &str) -> String {
    mutate(
        core,
        "createProject",
        json!({ "input": { "name": name, "parentId": null, "color": "blue" } }),
    )
    .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned()
}

#[test]
fn commands_round_trip_as_json() {
    let Fixture { core, _dir } = fixture();
    let id = create_project(&core, "Thesis");
    let projects = query(&core, "listProjects", json!({})).unwrap();
    assert_eq!(projects[0]["id"], id);
    assert_eq!(projects[0]["name"], "Thesis");
}

#[test]
fn empty_arguments_read_as_null() {
    let Fixture { core, _dir } = fixture();
    let projects = block_on(core.query("listProjects".into(), String::new())).unwrap();
    assert_eq!(projects, "[]");
}

#[test]
fn errors_keep_the_desktop_kinds() {
    let Fixture { core, _dir } = fixture();
    assert!(matches!(
        mutate(&core, "listProjects", json!({})),
        Err(CoreError::Invalid { message }) if message == "listProjects isn't a mutation."
    ));
    assert!(matches!(
        block_on(core.mutate("createProject".into(), "{".into())),
        Err(CoreError::Invalid { message }) if message.starts_with("Arguments:")
    ));
    assert!(matches!(
        query(
            &core,
            "getTask",
            json!({ "id": "0193a5c0-0000-7000-8000-00000000dead" })
        ),
        Err(CoreError::NotFound { .. })
    ));
    assert!(matches!(
        block_on(core.bind_scope("not-a-uuid".into())),
        Err(CoreError::Invalid { .. })
    ));
}

#[test]
fn an_unbound_device_queues_nothing() {
    let Fixture { core, _dir } = fixture();
    create_project(&core, "Local");
    let status = core.status().unwrap();
    assert_eq!(status.scope_id, None);
    assert_eq!(status.pending, 0);
    assert_eq!(core.push_request(100).unwrap(), None);
}

#[test]
fn a_bound_device_pushes_its_writes_as_protobuf() {
    let Fixture { core, _dir } = fixture();
    assert_eq!(
        block_on(core.bind_scope(SCOPE.into())).unwrap(),
        SignInOutcome::Uploading { rows: 0 }
    );
    create_project(&core, "Synced");

    let status = core.status().unwrap();
    assert_eq!(status.scope_id.as_deref(), Some(SCOPE));
    assert_eq!(status.pending, 1);
    assert_eq!(status.cursor_version, 0);

    let push = PushRequest::decode(core.push_request(100).unwrap().unwrap().as_slice()).unwrap();
    assert_eq!(push.client_id, status.client_id);
    assert_eq!(push.mutations.len(), 1);
    assert_eq!(push.mutations[0].name, "createProject");

    let pull = PullRequest::decode(core.pull_request(500).unwrap().as_slice()).unwrap();
    assert_eq!(pull.client_id, status.client_id);
    assert_eq!(pull.limit, 500);
}

#[test]
fn broken_responses_are_refused() {
    let Fixture { core, _dir } = fixture();
    block_on(core.bind_scope(SCOPE.into())).unwrap();
    assert!(core.apply_push_response(vec![0xff, 0xff, 0xff]).is_err());
    assert!(core.apply_pull_response(vec![0xff, 0xff, 0xff]).is_err());
    assert!(core.issues().unwrap().is_empty());
    assert!(!core.dismiss_issue(1).unwrap());
    assert!(block_on(core.retry_issue(1)).is_err());
}

#[test]
fn another_account_waits_for_a_choice() {
    let Fixture { core, _dir } = fixture();
    block_on(core.bind_scope(SCOPE.into())).unwrap();
    assert_eq!(
        block_on(core.bind_scope(SCOPE.into())).unwrap(),
        SignInOutcome::Synced
    );
    assert_eq!(
        block_on(core.bind_scope(OTHER.into())).unwrap(),
        SignInOutcome::OtherAccount {
            bound: SCOPE.into()
        }
    );
    create_project(&core, "Kept");
    assert_eq!(block_on(core.keep_local(OTHER.into())).unwrap(), 1);
    assert_eq!(core.status().unwrap().scope_id.as_deref(), Some(OTHER));

    block_on(core.start_fresh(SCOPE.into())).unwrap();
    assert_eq!(query(&core, "listProjects", json!({})).unwrap(), json!([]));
    assert_eq!(core.status().unwrap().scope_id.as_deref(), Some(SCOPE));
}

#[test]
fn forgetting_clears_the_account_and_its_rows() {
    let Fixture { core, _dir } = fixture();
    block_on(core.bind_scope(SCOPE.into())).unwrap();
    create_project(&core, "Gone");
    block_on(core.forget()).unwrap();
    let status = core.status().unwrap();
    assert_eq!(status.scope_id, None);
    assert_eq!(status.pending, 0);
    assert_eq!(query(&core, "listProjects", json!({})).unwrap(), json!([]));
}

#[test]
fn reopening_keeps_the_data() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("time.db").to_string_lossy().into_owned();
    let first = block_on(open(path.clone())).unwrap();
    create_project(&first, "Durable");
    drop(first);
    let second = block_on(open(path)).unwrap();
    assert_eq!(
        query(&second, "listProjects", json!({})).unwrap()[0]["name"],
        "Durable"
    );
}

#[test]
fn an_unopenable_file_is_a_database_error() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("missing").join("time.db");
    assert!(matches!(
        block_on(open(path.to_string_lossy().into_owned())),
        Err(CoreError::Database { .. })
    ));
}
