use std::collections::BTreeSet;

use chrono::DateTime;
use rusqlite::Connection;
use serde_json::{Value, json};

use super::*;
use crate::db::Db;
use crate::env::{Env, FixedClock, IdSource, SequentialIds};

const BINDINGS: &str = include_str!("../../../shared/contract/src/bindings.ts");
const CLASSIFIED: &str = include_str!("../../../shared/contract/src/commands.json");

fn classified(kind: &str) -> BTreeSet<String> {
    let json: Value = serde_json::from_str(CLASSIFIED).expect("commands.json parses");
    json[kind]
        .as_array()
        .unwrap_or_else(|| panic!("commands.json lists {kind}"))
        .iter()
        .map(|name| name.as_str().expect("a command name").to_owned())
        .collect()
}

fn owned(names: &[&str]) -> BTreeSet<String> {
    names.iter().map(|name| (*name).to_owned()).collect()
}

#[test]
fn the_registry_matches_commands_json() {
    assert_eq!(owned(MUTATIONS), classified("mutations"));
    assert_eq!(owned(READS), classified("reads"));
    assert_eq!(owned(DEVICE_ONLY), classified("deviceOnly"));
    assert_eq!(owned(SYNC_MUTATIONS), classified("syncMutations"));
}

fn contract_commands() -> BTreeSet<&'static str> {
    let commands = BINDINGS
        .split("export const commands = {")
        .nth(1)
        .and_then(|rest| rest.split("\n}").next())
        .expect("bindings list their commands");
    commands
        .lines()
        .filter_map(|line| line.trim_start().split_once(": ("))
        .map(|(name, _)| name)
        .collect()
}

#[test]
fn every_contract_command_is_classified_exactly_once() {
    let contract = contract_commands();
    assert!(contract.len() > 100);
    let mut classified = BTreeSet::new();
    for name in MUTATIONS.iter().chain(READS).chain(DEVICE_ONLY) {
        assert!(classified.insert(*name), "{name} is listed twice");
    }
    assert_eq!(classified, contract);
}

#[test]
fn every_mutation_and_read_has_a_dispatch_entry() {
    let db = Db::in_memory().unwrap();
    let env = fixed_env();
    db.call(|conn| {
        for name in MUTATIONS.iter().chain(SYNC_MUTATIONS) {
            let tx = conn.transaction()?;
            if let Err(error) = apply(&tx, &env, name, &json!({})) {
                assert!(!error.to_string().contains("isn't a mutation"), "{name}");
            }
        }
        for name in READS {
            if let Err(error) = query(conn, name, &json!({})) {
                assert!(!error.to_string().contains("isn't a read"), "{name}");
            }
        }
        assert!(apply(conn, &env, "listTasks", &json!({})).is_err());
        assert!(query(conn, "createTask", &json!({})).is_err());
        assert!(is_mutation("createTask") && !is_mutation("listTasks"));
        assert!(is_read("listTasks") && !is_read("exportData"));
        Ok(())
    })
    .unwrap();
}

fn fixed_env() -> Env<FixedClock, SequentialIds> {
    let now = DateTime::parse_from_rfc3339("2026-11-04T10:00:00+09:00").unwrap();
    Env {
        clock: FixedClock(now),
        ids: SequentialIds::starting_at(1_793_000_000_000),
    }
}

struct Scenario<'a> {
    conn: &'a Connection,
    env: Env<FixedClock, SequentialIds>,
    applied: Vec<(String, Value)>,
}

impl Scenario<'_> {
    fn run(&mut self, name: &str, args: Value) -> Value {
        let result = apply(self.conn, &self.env, name, &args)
            .unwrap_or_else(|error| panic!("{name}: {error}"));
        self.applied.push((name.to_owned(), result.clone()));
        result
    }

    fn id(&mut self, name: &str, args: Value) -> Value {
        let result = self.run(name, args);
        match result {
            Value::String(_) => result,
            other => other["id"].clone(),
        }
    }

    fn read(&self, name: &str, args: Value) -> Value {
        query(self.conn, name, &args).unwrap_or_else(|error| panic!("{name}: {error}"))
    }
}

fn task(title: &str, project: &Value, section: &Value) -> Value {
    json!({
        "title": title, "notes": "", "projectId": project, "sectionId": section,
        "parentId": null, "priority": 4, "dueDate": null, "dueTime": null,
        "deadline": null, "recurrence": null, "estimateMinutes": null
    })
}

fn habit(name: &str) -> Value {
    json!({
        "name": name, "kind": "build", "goal": 1.0, "unit": "times", "days": 127,
        "timeOfDay": "anytime", "area": "", "startDate": "2026-10-01", "tracking": null,
        "skipDays": 0, "anchor": ""
    })
}

/// Applies every mutation once through the registry, the way a synced
/// device or the server would, and returns what each produced.
fn walk_every_mutation(conn: &Connection) -> Vec<(String, Value)> {
    let mut s = Scenario {
        conn,
        env: fixed_env(),
        applied: Vec::new(),
    };
    let null = Value::Null;
    let now = s.env.clock.0.timestamp();

    let website = s.id(
        "createProject",
        json!({"input": {"name": "Website", "parentId": null, "color": "blue"}}),
    );
    let copy = s.id(
        "createProject",
        json!({"input": {"name": "Copy", "parentId": website, "color": "teal"}}),
    );
    s.run(
        "updateProject",
        json!({"id": copy, "input": {"name": "Copywriting", "parentId": website, "color": "teal"}}),
    );
    s.run("setProjectView", json!({"id": website, "view": "board"}));
    let acme = s.id("createGroup", json!({"name": "Acme"}));
    s.run("renameGroup", json!({"id": acme, "name": "Acme Inc"}));
    s.run(
        "updateProjectSettings",
        json!({"id": website, "settings": {
            "groupId": acme, "status": "active", "outcome": "Launch", "weeklyMinutes": 360,
            "targetDate": null, "killCriteria": "", "reviewEveryWeeks": 1, "inOrder": false
        }}),
    );
    s.run("markProjectReviewed", json!({"id": website}));
    s.run(
        "saveProjectCanvas",
        json!({"projectId": website, "content": "<p>Plan</p>"}),
    );
    let software = s.read("listPresets", json!({}))[1].clone();
    s.run(
        "applyProjectPreset",
        json!({"id": website, "preset": software}),
    );

    let doing = s.id(
        "createSection",
        json!({"projectId": website, "name": "Doing", "before": null}),
    );
    let later = s.id(
        "createSection",
        json!({"projectId": website, "name": "Later", "before": doing}),
    );
    s.run("renameSection", json!({"id": later, "name": "Someday"}));
    s.run(
        "setSectionCollapsed",
        json!({"id": later, "collapsed": true}),
    );
    s.run("reorderSection", json!({"id": later, "before": null}));

    let login = s.id(
        "createTask",
        json!({"input": task("Fix login", &website, &doing)}),
    );
    let tests = s.id(
        "createTask",
        json!({"input": task("Write tests", &website, &null)}),
    );
    s.run(
        "updateTask",
        json!({"id": tests, "input": task("Write more tests", &website, &null)}),
    );
    s.run(
        "moveTask",
        json!({"id": tests, "placement": {
            "projectId": website, "sectionId": doing, "parentId": null, "before": login
        }}),
    );
    s.run(
        "addTaskDependency",
        json!({"taskId": login, "blockedById": tests}),
    );
    s.run(
        "removeTaskDependency",
        json!({"taskId": login, "blockedById": tests}),
    );
    s.run(
        "rescheduleTasks",
        json!({"ids": [login], "dueDate": "2026-11-05"}),
    );
    s.run("setTaskMust", json!({"id": login, "mustOn": "2026-11-05"}));
    s.run(
        "setTaskNextStep",
        json!({"id": login, "nextStep": "Reproduce it"}),
    );
    s.run("setTasksSomeday", json!({"ids": [tests], "someday": true}));

    let spike = s.id(
        "createItemType",
        json!({"projectId": website, "input": {
            "name": "Spike", "icon": "flag", "kind": "task", "defaultMinutes": null, "checklist": "Read\nWrite"
        }}),
    );
    s.run(
        "updateItemType",
        json!({"id": spike, "input": {
            "name": "Research", "icon": "flag", "kind": "task", "defaultMinutes": 30, "checklist": ""
        }}),
    );
    s.run("setTaskTypeId", json!({"id": login, "typeId": spike}));
    let waiting = s.id(
        "createItemStatus",
        json!({"projectId": website, "input": {"name": "Blocked", "category": "active"}}),
    );
    s.run(
        "updateItemStatus",
        json!({"id": waiting, "input": {"name": "Waiting", "category": "active"}}),
    );
    s.run("reorderItemStatus", json!({"id": waiting, "before": null}));
    s.run("setTaskStatusId", json!({"id": login, "statusId": waiting}));
    let release = s.id(
        "createProjectMilestone",
        json!({"projectId": website, "input": {"name": "v1", "date": "2026-12-01"}}),
    );
    s.run(
        "updateProjectMilestone",
        json!({"id": release, "input": {"name": "v1.0", "date": "2026-12-01"}}),
    );
    s.run(
        "setTaskMilestoneId",
        json!({"id": login, "milestoneId": release}),
    );
    s.run(
        "setProjectMilestoneLabel",
        json!({"id": website, "label": "Releases"}),
    );
    let mine = s.id(
        "createSavedView",
        json!({"projectId": website, "input": {
            "name": "Mine", "layout": "list", "groupBy": "none", "filter": "{}", "sort": "manual"
        }}),
    );
    s.run(
        "updateSavedView",
        json!({"id": mine, "input": {
            "name": "Ours", "layout": "board", "groupBy": "status", "filter": "{}", "sort": "manual"
        }}),
    );
    s.run(
        "setTaskEventDetails",
        json!({"id": login, "location": "Room 1", "countsAsTime": false}),
    );

    let lead = s.id(
        "createItemType",
        json!({"projectId": website, "input": {
            "name": "Lead", "icon": "target", "kind": "record", "defaultMinutes": null, "checklist": ""
        }}),
    );
    let deal = s.id(
        "createTask",
        json!({"input": task("Acme deal", &website, &null)}),
    );
    s.run("setTaskTypeId", json!({"id": deal, "typeId": lead}));
    let call = s.id(
        "createPhaseTask",
        json!({"recordId": deal, "phaseId": waiting, "title": "Call them"}),
    );
    s.run("setTaskPhase", json!({"id": call, "phaseId": null}));
    s.run(
        "setRecordPhaseNotes",
        json!({"taskId": deal, "statusId": waiting, "notes": "Warm lead"}),
    );

    let hour = now - now % 3600 - 3 * 3600;
    let block = s.id(
        "createBlock",
        json!({"taskId": login, "span": {"startAt": hour, "endAt": hour + 3600}}),
    );
    s.run(
        "rescheduleBlock",
        json!({"id": block, "span": {"startAt": hour + 3600, "endAt": hour + 5400}}),
    );
    let entry = s.id(
        "createTimeEntry",
        json!({"input": {
            "description": "debugging", "projectId": null, "taskId": login,
            "startedAt": now - 3600, "endedAt": now - 1800
        }}),
    );
    s.run(
        "updateTimeEntry",
        json!({"id": entry, "input": {
            "description": "debugging login", "projectId": null, "taskId": login,
            "startedAt": now - 3600, "endedAt": now - 1200
        }}),
    );
    let focus = json!({"description": "focus", "projectId": null, "taskId": login});
    s.run("startTimer", json!({"details": focus}));
    s.run(
        "editTimer",
        json!({"details": {"description": "deep focus", "projectId": website, "taskId": null}}),
    );
    s.run("pauseTimer", json!({}));
    s.run("resumeTimer", json!({}));
    s.run("stopTimer", json!({}));
    s.run(
        "restoreTimer",
        json!({"timer": {
            "description": "back", "projectId": null, "taskId": null,
            "startedAt": now - 60, "pausedAt": null, "bankedSeconds": 0
        }}),
    );
    s.run("discardTimer", json!({}));

    let water = s.id("createHabit", json!({"input": habit("Water")}));
    s.run(
        "updateHabit",
        json!({"id": water, "input": habit("Drink water")}),
    );
    s.run(
        "setHabitStatus",
        json!({"habitId": water, "date": "2026-11-03", "status": "done"}),
    );
    s.run(
        "addHabitValue",
        json!({"habitId": water, "date": "2026-11-04", "delta": 1.0}),
    );
    s.run("archiveHabit", json!({"id": water}));
    let mut screen = habit("Less YouTube");
    screen["kind"] = json!("limit");
    screen["tracking"] =
        json!({"source": "website", "patterns": ["youtube.com"], "projectId": null});
    let screen = s.id("createHabit", json!({"input": screen}));
    s.run(
        "recordHabitMeasurements",
        json!({"measurements": [{"habitId": screen, "date": "2026-11-03", "value": 2.0}]}),
    );

    s.run("rateDay", json!({"date": "2026-11-03", "felt": 4}));
    s.run(
        "saveDayNote",
        json!({"date": "2026-11-03", "note": "steady"}),
    );
    s.run("skipDayCheckIn", json!({"date": "2026-11-02"}));
    s.run(
        "saveWeekNotes",
        json!({"date": "2026-11-02", "notes": {"worked": "focus", "fellShort": "sleep", "change": "earlier"}}),
    );
    s.run("rateWeek", json!({"date": "2026-11-02", "felt": 3}));
    s.run("reachReviewStep", json!({"date": "2026-11-02", "step": 2}));
    s.run("finishWeekReview", json!({"date": "2026-11-02"}));
    let quarter = s.id(
        "upsertQuarter",
        json!({"id": null, "label": "2026 Q4", "startDate": "2026-09-28"}),
    );
    s.run(
        "createPriority",
        json!({"quarterId": quarter, "title": "Ship the site"}),
    );
    let priority =
        s.read("getQuarter", json!({"date": "2026-11-04"}))["priorities"][0]["id"].clone();
    s.run(
        "updatePriority",
        json!({"id": priority, "title": "Ship it", "note": "by December"}),
    );
    s.run(
        "createOutcome",
        json!({"date": "2026-11-02", "title": "Beta", "priorityId": priority}),
    );
    let outcome = s.read("getWeek", json!({"date": "2026-11-04"}))["outcomes"][0]["id"].clone();
    s.run(
        "updateOutcome",
        json!({"id": outcome, "title": "Beta out", "priorityId": null}),
    );
    s.run("setTaskOutcome", json!({"id": login, "outcomeId": outcome}));
    s.run(
        "updateOutcomeStatus",
        json!({"id": outcome, "status": "achieved"}),
    );
    s.run("removePriority", json!({"id": priority}));
    s.run("removeOutcome", json!({"id": outcome}));

    s.run(
        "updateRitual",
        json!({"kind": "evening", "input": {
            "enabled": true, "trigger": "at_time", "atMinute": 1080, "weekdays": 127, "steps": ["feel"]
        }}),
    );
    s.run("choosePlanningTime", json!({"time": "morning"}));
    let morning = s.id("startRitual", json!({"kind": "morning", "taskId": null}));
    s.run("reachRitualStep", json!({"id": morning, "step": 1}));
    s.run("snoozeRitual", json!({"id": morning}));
    s.run("skipRitual", json!({"id": morning}));
    s.run("finishRitual", json!({"id": morning}));

    s.run("setTaskCompleted", json!({"id": tests, "completed": true}));
    s.run(
        "importProjects",
        json!({"projects": [{
            "name": "Imported", "color": "green", "sections": [],
            "tasks": [{"task": task("Buy milk", &null, &null), "children": []}]
        }]}),
    );
    s.run("setRemindersEnabled", json!({"enabled": false}));

    let todo = s.read("getWorkflow", json!({}))["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|status| status["name"] == "Todo")
        .unwrap()["id"]
        .clone();
    s.run("deleteBlock", json!({"id": block}));
    s.run("deleteTimeEntry", json!({"id": entry}));
    s.run("deleteSavedView", json!({"id": mine}));
    s.run("deleteProjectMilestone", json!({"id": release}));
    s.run(
        "deleteItemStatus",
        json!({"id": waiting, "replacement": todo}),
    );
    s.run("deleteItemType", json!({"id": spike, "replacement": null}));
    s.run("deleteTask", json!({"id": call}));
    let snapshot = s.read("captureTasks", json!({"ids": [tests]}));
    s.run("deleteTasks", json!({"ids": [tests]}));
    s.run("restoreTasks", json!({"snapshot": snapshot}));
    s.run("deleteTasks", json!({"ids": [tests]}));
    s.run("deleteSection", json!({"id": later}));
    s.run("deleteGroup", json!({"id": acme}));
    s.run("setProjectArchived", json!({"id": copy, "archived": true}));
    s.run("deleteProject", json!({"id": copy}));
    let tasks = s.read("listTasks", json!({}));
    s.run("deleteAllData", json!({}));
    s.applied.push(("listTasks".to_owned(), tasks));

    s.applied
}

#[test]
fn every_mutation_round_trips_through_the_registry() {
    let db = Db::in_memory().unwrap();
    let applied = db.call(|conn| Ok(walk_every_mutation(conn))).unwrap();
    let walked: BTreeSet<&str> = applied
        .iter()
        .map(|(name, _)| name.as_str())
        .filter(|name| is_mutation(name))
        .collect();
    let registered: BTreeSet<&str> = MUTATIONS.iter().copied().collect();
    assert_eq!(walked, registered);

    let (_, tasks) = applied.last().unwrap();
    let titles: Vec<&str> = tasks
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|task| task["title"].as_str())
        .collect();
    assert!(titles.contains(&"Fix login") && titles.contains(&"Buy milk"));
    assert!(!titles.contains(&"Write more tests"));

    db.call(|conn| {
        assert_eq!(query(conn, "listTasks", &json!({}))?, json!([]));
        assert_eq!(query(conn, "getRemindersEnabled", &json!({}))?, json!(true));
        assert_eq!(query(conn, "listRituals", &json!({}))?.as_array().unwrap().len(), 5);
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_fixed_env_gives_the_same_results_every_time() {
    let first = Db::in_memory()
        .unwrap()
        .call(|conn| Ok(walk_every_mutation(conn)))
        .unwrap();
    let second = Db::in_memory()
        .unwrap()
        .call(|conn| Ok(walk_every_mutation(conn)))
        .unwrap();
    assert_eq!(first, second);
    let created = &first[0].1;
    assert_eq!(created["id"], json!(fixed_env().ids.next_id()));
    assert_eq!(
        created["lastReviewedAt"],
        Value::Null,
        "the project was reviewed later"
    );
}

#[test]
fn a_failed_mutation_leaves_nothing_behind() {
    let db = Db::in_memory().unwrap();
    let env = fixed_env();
    db.call(|conn| {
        let bad = json!({"projects": [
            {"name": "Good", "color": "blue", "sections": [], "tasks": []},
            {"name": "Bad", "color": "nope", "sections": [], "tasks": []}
        ]});
        assert!(apply_in_transaction(conn, &env, "importProjects", &bad).is_err());
        assert_eq!(query(conn, "listProjects", &json!({}))?, json!([]));
        Ok(())
    })
    .unwrap();
}
