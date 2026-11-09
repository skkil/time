mod scenarios;
mod server;

use serde_json::{Value, json};

use super::{Engine, SignIn};
use crate::data::{LocalData, dump};
use server::FakeServer;

/// One device: an [`Engine`] over an in-memory database.
struct Device {
    engine: Engine,
}

impl Device {
    fn new() -> Self {
        Self {
            engine: Engine::in_memory().unwrap(),
        }
    }

    /// A device signed in to `server`'s account and caught up.
    fn signed_in(server: &mut FakeServer) -> Self {
        let mut device = Self::new();
        assert!(matches!(
            device.engine.sign_in(server.scope).unwrap(),
            SignIn::Uploading { .. }
        ));
        device.sync(server);
        device
    }

    fn run(&mut self, name: &str, args: Value) -> Value {
        self.engine
            .mutate(name, &args)
            .unwrap_or_else(|error| panic!("{name}: {error}"))
    }

    fn read(&self, name: &str, args: Value) -> Value {
        self.engine.query(name, &args).unwrap()
    }

    fn id(&mut self, name: &str, args: Value) -> String {
        self.run(name, args)["id"].as_str().unwrap().to_owned()
    }

    /// Pushes everything and pulls until caught up, the way a host's sync
    /// loop does.
    fn sync(&mut self, server: &mut FakeServer) {
        for _ in 0..8 {
            while let Some(request) = self.engine.push_request(100).unwrap() {
                let response = server.push(&request);
                self.engine.apply_push_response(&response).unwrap();
            }
            loop {
                let request = self.engine.pull_request(100).unwrap();
                let outcome = self
                    .engine
                    .apply_pull_response(&server.pull(&request))
                    .unwrap();
                if !outcome.more {
                    break;
                }
            }
            if self.engine.push_request(1).unwrap().is_none() {
                return;
            }
        }
        panic!("sync didn't settle");
    }

    /// Every synced row, minus the columns only this device keeps.
    fn data(&self) -> LocalData {
        comparable(dump(self.engine.connection()).unwrap())
    }

    fn titles(&self) -> Vec<String> {
        let mut titles: Vec<String> = self
            .read("listTasks", json!({}))
            .as_array()
            .unwrap()
            .iter()
            .map(|task| task["title"].as_str().unwrap().to_owned())
            .collect();
        titles.sort();
        titles
    }
}

fn comparable(mut data: LocalData) -> LocalData {
    for table in &mut data.tables {
        for row in &mut table.rows {
            row.remove("reminded_for");
        }
    }
    data
}

fn task(title: &str, project: Option<&str>) -> Value {
    json!({
        "title": title, "notes": "", "projectId": project, "sectionId": null,
        "parentId": null, "priority": 4, "dueDate": null, "dueTime": null,
        "deadline": null, "recurrence": null, "estimateMinutes": null
    })
}

fn project(name: &str) -> Value {
    json!({ "name": name, "parentId": null, "color": "blue" })
}
