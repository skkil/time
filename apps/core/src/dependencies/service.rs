use rusqlite::{Connection, params};

use super::queries::would_loop;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::tasks::{self, Task};
use crate::types::Id;

pub fn add(
    conn: &Connection,
    env: &dyn MutationEnv,
    task_id: &Id,
    blocked_by_id: &Id,
) -> Result<Task> {
    if task_id == blocked_by_id {
        return Err(Error::invalid("A task can't wait on itself."));
    }
    tasks::get(conn, task_id)?;
    let blocker = tasks::get(conn, blocked_by_id)?;
    if blocker.recurrence.is_some() {
        return Err(Error::invalid(
            "A repeating task never finishes, so nothing can wait on it.",
        ));
    }
    if blocker.kind == "event" {
        return Err(Error::invalid(
            "Events don't finish, so nothing can wait on them.",
        ));
    }
    if would_loop(conn, task_id, blocked_by_id)? {
        return Err(Error::invalid(format!(
            "“{}” already waits on this task.",
            blocker.title
        )));
    }
    conn.execute(
        "INSERT OR IGNORE INTO task_dependency (id, task_id, blocked_by_id) VALUES (?1, ?2, ?3)",
        params![env.next_id(), task_id, blocked_by_id],
    )?;
    tasks::get(conn, task_id)
}

pub fn remove(conn: &Connection, task_id: &Id, blocked_by_id: &Id) -> Result<Task> {
    conn.execute(
        "DELETE FROM task_dependency WHERE task_id = ?1 AND blocked_by_id = ?2",
        params![task_id, blocked_by_id],
    )?;
    tasks::get(conn, task_id)
}
