use rusqlite::{Connection, params};
use tauri::State;

use super::tasks::{self, Task};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::Id;

fn would_loop(conn: &Connection, task_id: Id, blocked_by_id: Id) -> Result<bool> {
    Ok(conn.query_row(
        "WITH RECURSIVE up(id) AS (
           SELECT ?1
           UNION
           SELECT d.blocked_by_id FROM task_dependency d JOIN up ON d.task_id = up.id
         )
         SELECT EXISTS(SELECT 1 FROM up WHERE id = ?2)",
        params![blocked_by_id, task_id],
        |row| row.get(0),
    )?)
}

pub fn add(conn: &Connection, task_id: Id, blocked_by_id: Id) -> Result<Task> {
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
        "INSERT OR IGNORE INTO task_dependency (task_id, blocked_by_id) VALUES (?1, ?2)",
        params![task_id, blocked_by_id],
    )?;
    tasks::get(conn, task_id)
}

pub fn remove(conn: &Connection, task_id: Id, blocked_by_id: Id) -> Result<Task> {
    conn.execute(
        "DELETE FROM task_dependency WHERE task_id = ?1 AND blocked_by_id = ?2",
        params![task_id, blocked_by_id],
    )?;
    tasks::get(conn, task_id)
}

#[tauri::command]
#[specta::specta]
pub async fn add_task_dependency(
    db: State<'_, Db>,
    task_id: Id,
    blocked_by_id: Id,
) -> Result<Task> {
    db.call(|conn| add(conn, task_id, blocked_by_id))
}

#[tauri::command]
#[specta::specta]
pub async fn remove_task_dependency(
    db: State<'_, Db>,
    task_id: Id,
    blocked_by_id: Id,
) -> Result<Task> {
    db.call(|conn| remove(conn, task_id, blocked_by_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::tasks::{create, input, set_completed};
    use crate::types::date;

    #[test]
    fn waits_until_every_blocker_is_done() {
        let db = Db::in_memory();
        db.call(|conn| {
            let launch = create(conn, &input("Launch", None))?;
            let copy = create(conn, &input("Write copy", None))?;
            let site = create(conn, &input("Build site", None))?;
            add(conn, launch.id, copy.id)?;
            let launch = add(conn, launch.id, site.id)?;
            assert_eq!(launch.blocked_by.len(), 2);
            assert_eq!(launch.waiting_on.len(), 2);

            set_completed(conn, copy.id, true)?;
            let launch = tasks::get(conn, launch.id)?;
            assert_eq!(launch.waiting_on, vec![site.id]);
            assert_eq!(launch.blocked_by.len(), 2);

            let launch = remove(conn, launch.id, site.id)?;
            assert!(launch.waiting_on.is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn refuses_loops_self_and_repeating_blockers() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = create(conn, &input("A", None))?;
            let b = create(conn, &input("B", None))?;
            let c = create(conn, &input("C", None))?;
            add(conn, a.id, b.id)?;
            add(conn, b.id, c.id)?;
            assert!(add(conn, c.id, a.id).is_err());
            assert!(add(conn, a.id, a.id).is_err());

            let mut daily = input("Inbox zero", None);
            daily.due_date = Some(date("2026-11-03"));
            daily.recurrence = Some("every day".into());
            let daily = create(conn, &daily)?;
            assert!(add(conn, a.id, daily.id).is_err());

            tasks::delete(conn, b.id)?;
            assert!(tasks::get(conn, a.id)?.blocked_by.is_empty());
            Ok(())
        })
        .unwrap();
    }
}
