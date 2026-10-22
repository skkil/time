use rusqlite::Connection;

use crate::db::Db;
use crate::env::LocalEnv;
use crate::error::Result;
use crate::projects::{self, ProjectInput};
use crate::tasks::TaskInput;
use crate::types::Id;

pub fn db() -> Db {
    Db::in_memory().expect("in-memory database")
}

pub fn env() -> LocalEnv {
    LocalEnv::default()
}

pub fn project_input(name: &str, parent_id: Option<&Id>) -> ProjectInput {
    ProjectInput {
        name: name.into(),
        parent_id: parent_id.cloned(),
        color: "blue".into(),
    }
}

pub fn project(conn: &Connection, name: &str) -> Result<Id> {
    Ok(projects::create(conn, &env(), &project_input(name, None))?.id)
}

pub fn task_input(title: &str, project_id: Option<&Id>) -> TaskInput {
    TaskInput {
        title: title.into(),
        notes: String::new(),
        project_id: project_id.cloned(),
        section_id: None,
        parent_id: None,
        priority: 4,
        due_date: None,
        due_time: None,
        deadline: None,
        recurrence: None,
        estimate_minutes: None,
    }
}

pub fn missing_id() -> Id {
    Id::parse("00000000-0000-7000-8000-000000000000").expect("valid id")
}
