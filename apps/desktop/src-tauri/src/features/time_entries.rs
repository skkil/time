use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, optional_text, projects, tasks};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Date, Id, Timestamp};

const MAX_ENTRY_SECONDS: i64 = Timestamp::DAY;
const FUTURE_TOLERANCE_SECONDS: i64 = 60;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TimeEntry {
    pub id: Id,
    pub description: String,
    pub project_id: Option<Id>,
    pub task_id: Option<Id>,
    pub started_at: Timestamp,
    pub ended_at: Timestamp,
}

#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EntryDetails {
    pub description: String,
    pub project_id: Option<Id>,
    pub task_id: Option<Id>,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    #[serde(flatten)]
    pub details: EntryDetails,
    pub started_at: Timestamp,
    pub ended_at: Timestamp,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RunningTimer {
    pub description: String,
    pub project_id: Option<Id>,
    pub task_id: Option<Id>,
    pub started_at: Timestamp,
}

#[derive(Default)]
pub struct Timer(Mutex<Option<RunningTimer>>);

impl Timer {
    pub(crate) fn with<T>(&self, run: impl FnOnce(&mut Option<RunningTimer>) -> T) -> T {
        let mut running = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        run(&mut running)
    }
}

const SELECT: &str =
    "SELECT id, description, project_id, task_id, started_at, ended_at FROM time_entry";

fn from_row(row: &Row) -> rusqlite::Result<TimeEntry> {
    Ok(TimeEntry {
        id: row.get(0)?,
        description: row.get(1)?,
        project_id: row.get(2)?,
        task_id: row.get(3)?,
        started_at: row.get(4)?,
        ended_at: row.get(5)?,
    })
}

fn get(conn: &Connection, id: Id) -> Result<TimeEntry> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Time entry"))
}

fn resolve(conn: &Connection, details: &EntryDetails) -> Result<EntryDetails> {
    let description = optional_text(&details.description, "Description", 500)?;
    let project_id = match details.task_id {
        Some(task_id) => tasks::get(conn, task_id)?.project_id,
        None => details.project_id,
    };
    if let Some(project_id) = project_id {
        projects::get(conn, project_id)?;
    }
    Ok(EntryDetails {
        description,
        project_id,
        task_id: details.task_id,
    })
}

fn validate_span(started_at: Timestamp, ended_at: Timestamp) -> Result<()> {
    let length = started_at.seconds_until(ended_at);
    if length < 0 {
        return Err(Error::invalid("An entry must end after it starts."));
    }
    if length > MAX_ENTRY_SECONDS {
        return Err(Error::invalid("An entry can't be longer than 24 hours."));
    }
    if ended_at.0 > Timestamp::now().0 + FUTURE_TOLERANCE_SECONDS {
        return Err(Error::invalid("An entry can't end in the future."));
    }
    Ok(())
}

pub fn list(conn: &Connection, from: Date, to: Date) -> Result<Vec<TimeEntry>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT} WHERE started_at < ?2 AND ended_at > ?1 ORDER BY started_at DESC"
    ))?;
    let rows = stmt.query_map(params![from.start(), to.start()], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn create(conn: &Connection, input: &EntryInput) -> Result<TimeEntry> {
    validate_span(input.started_at, input.ended_at)?;
    let details = resolve(conn, &input.details)?;
    conn.execute(
        "INSERT INTO time_entry (description, project_id, task_id, started_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            details.description,
            details.project_id,
            details.task_id,
            input.started_at,
            input.ended_at
        ],
    )?;
    get(conn, Id(conn.last_insert_rowid()))
}

pub fn update(conn: &Connection, id: Id, input: &EntryInput) -> Result<TimeEntry> {
    validate_span(input.started_at, input.ended_at)?;
    let details = resolve(conn, &input.details)?;
    let rows = conn.execute(
        "UPDATE time_entry
         SET description = ?1, project_id = ?2, task_id = ?3, started_at = ?4, ended_at = ?5
         WHERE id = ?6",
        params![
            details.description,
            details.project_id,
            details.task_id,
            input.started_at,
            input.ended_at,
            id
        ],
    )?;
    ensure_changed(rows, "Time entry")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM time_entry WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Time entry")
}

pub fn running(conn: &Connection) -> Result<Option<RunningTimer>> {
    Ok(conn
        .query_row(
            "SELECT description, project_id, task_id, started_at FROM running_timer WHERE id = 1",
            [],
            |row| {
                Ok(RunningTimer {
                    description: row.get(0)?,
                    project_id: row.get(1)?,
                    task_id: row.get(2)?,
                    started_at: row.get(3)?,
                })
            },
        )
        .optional()?)
}

fn save_running(conn: &Connection, running: &RunningTimer) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO running_timer (id, description, project_id, task_id, started_at)
         VALUES (1, ?1, ?2, ?3, ?4)",
        params![
            running.description,
            running.project_id,
            running.task_id,
            running.started_at
        ],
    )?;
    Ok(())
}

fn clear_running(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM running_timer", [])?;
    Ok(())
}

fn finish(conn: &Connection, running: RunningTimer) -> Result<Option<TimeEntry>> {
    let ended_at = Timestamp::now();
    let started_at = Timestamp(running.started_at.0.max(ended_at.0 - MAX_ENTRY_SECONDS));
    if started_at.seconds_until(ended_at) < 1 {
        return Ok(None);
    }
    let input = EntryInput {
        details: EntryDetails {
            description: running.description,
            project_id: running.project_id,
            task_id: running.task_id,
        },
        started_at,
        ended_at,
    };
    create(conn, &input).map(Some)
}

pub fn start(conn: &Connection, details: &EntryDetails) -> Result<RunningTimer> {
    let details = resolve(conn, details)?;
    if let Some(previous) = running(conn)? {
        finish(conn, previous)?;
    }
    let next = RunningTimer {
        description: details.description,
        project_id: details.project_id,
        task_id: details.task_id,
        started_at: Timestamp::now(),
    };
    save_running(conn, &next)?;
    Ok(next)
}

pub fn edit_running(conn: &Connection, details: &EntryDetails) -> Result<RunningTimer> {
    let details = resolve(conn, details)?;
    let mut current = running(conn)?.ok_or_else(|| Error::invalid("No timer is running."))?;
    current.description = details.description;
    current.project_id = details.project_id;
    current.task_id = details.task_id;
    save_running(conn, &current)?;
    Ok(current)
}

pub fn stop(conn: &Connection) -> Result<Option<TimeEntry>> {
    let Some(current) = running(conn)? else {
        return Ok(None);
    };
    let entry = finish(conn, current)?;
    clear_running(conn)?;
    Ok(entry)
}

pub fn stop_for(conn: &Connection, tasks: &[Id]) -> Result<()> {
    let tracking = running(conn)?.is_some_and(|current| {
        current
            .task_id
            .is_some_and(|task_id| tasks.contains(&task_id))
    });
    if tracking {
        stop(conn)?;
    }
    Ok(())
}

pub fn discard(conn: &Connection) -> Result<()> {
    clear_running(conn)
}

#[tauri::command]
#[specta::specta]
pub async fn list_time_entries(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<TimeEntry>> {
    db.call(|conn| list(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn create_time_entry(db: State<'_, Db>, input: EntryInput) -> Result<TimeEntry> {
    db.call(|conn| create(conn, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_time_entry(db: State<'_, Db>, id: Id, input: EntryInput) -> Result<TimeEntry> {
    db.call(|conn| update(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_time_entry(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn get_timer(db: State<'_, Db>) -> Result<Option<RunningTimer>> {
    db.call(|conn| running(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn start_timer(db: State<'_, Db>, details: EntryDetails) -> Result<RunningTimer> {
    db.call(|conn| start(conn, &details))
}

#[tauri::command]
#[specta::specta]
pub async fn edit_timer(db: State<'_, Db>, details: EntryDetails) -> Result<RunningTimer> {
    db.call(|conn| edit_running(conn, &details))
}

#[tauri::command]
#[specta::specta]
pub async fn stop_timer(db: State<'_, Db>) -> Result<Option<TimeEntry>> {
    db.call(|conn| stop(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn discard_timer(db: State<'_, Db>) -> Result<()> {
    db.call(|conn| discard(conn))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn details(description: &str, task_id: Option<Id>) -> EntryDetails {
        EntryDetails {
            description: description.into(),
            project_id: None,
            task_id,
        }
    }

    #[test]
    fn linked_task_decides_the_project() {
        let db = Db::in_memory();
        db.call(|conn| {
            let project = projects::create(
                conn,
                &projects::ProjectInput {
                    name: "Thesis".into(),
                    parent_id: None,
                    color: "plum".into(),
                },
            )?;
            let task = tasks::create(conn, &tasks::input("Chapter 2", Some(project.id)))?;
            let now = Timestamp::now();
            let entry = create(
                conn,
                &EntryInput {
                    details: details("writing", Some(task.id)),
                    started_at: Timestamp(now.0 - 1800),
                    ended_at: now,
                },
            )?;
            assert_eq!(entry.project_id, Some(project.id));
            assert_eq!(tasks::get(conn, task.id)?.tracked_seconds.0, 1800);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rejects_backwards_and_future_entries() {
        let db = Db::in_memory();
        db.call(|conn| {
            let now = Timestamp::now();
            let backwards = EntryInput {
                details: details("", None),
                started_at: now,
                ended_at: Timestamp(now.0 - 10),
            };
            let future = EntryInput {
                details: details("", None),
                started_at: now,
                ended_at: Timestamp(now.0 + 3600),
            };
            assert!(create(conn, &backwards).is_err());
            assert!(create(conn, &future).is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn an_entry_shows_on_every_day_it_spans() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = Date::today();
            let midnight = today.add_days(-1).start().0;
            create(
                conn,
                &EntryInput {
                    details: details("late night", None),
                    started_at: Timestamp(midnight - 3600),
                    ended_at: Timestamp(midnight + 3600),
                },
            )?;
            assert_eq!(list(conn, today.add_days(-2), today.add_days(-1))?.len(), 1);
            assert_eq!(list(conn, today.add_days(-1), today)?.len(), 1);
            assert!(list(conn, today, today.add_days(1))?.is_empty());
            assert!(list(conn, today.add_days(-3), today.add_days(-2))?.is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn finishing_a_task_stops_the_timer_tracking_it() {
        let db = Db::in_memory();
        db.call(|conn| {
            let parent = tasks::create(conn, &tasks::input("Report", None))?;
            let mut child = tasks::input("Outline", None);
            child.parent_id = Some(parent.id);
            let child = tasks::create(conn, &child)?;
            let other = tasks::create(conn, &tasks::input("Email", None))?;
            let earlier = Timestamp(Timestamp::now().0 - 600);

            start(conn, &details("", Some(other.id)))?;
            tasks::set_completed(conn, parent.id, true)?;
            assert!(running(conn)?.is_some());

            start(conn, &details("", Some(child.id)))?;
            conn.execute("UPDATE running_timer SET started_at = ?1", params![earlier])?;
            tasks::set_completed(conn, parent.id, false)?;
            assert!(running(conn)?.is_some());
            tasks::set_completed(conn, parent.id, true)?;
            assert!(running(conn)?.is_none());
            assert!(tasks::get(conn, child.id)?.tracked_seconds.0 >= 600);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn starting_a_timer_finishes_the_previous_one() {
        let db = Db::in_memory();
        db.call(|conn| {
            start(conn, &details("first", None))?;
            conn.execute(
                "UPDATE running_timer SET started_at = ?1",
                params![Timestamp(Timestamp::now().0 - 600)],
            )?;
            start(conn, &details("second", None))?;

            let today = Date::today();
            let entries = list(conn, today.add_days(-1), today.add_days(1))?;
            assert_eq!(entries.len(), 1);
            assert_eq!(entries[0].description, "first");

            stop(conn)?;
            assert!(running(conn)?.is_none());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn running_timer_survives_a_restart() {
        let dir = std::env::temp_dir().join(format!("skkil-timer-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("time.db");
        Db::open(&path)
            .unwrap()
            .call(|conn| start(conn, &details("deep work", None)))
            .unwrap();
        let reopened = Db::open(&path).unwrap();
        let resumed = reopened.call(|conn| running(conn)).unwrap().unwrap();
        assert_eq!(resumed.description, "deep work");
        reopened.call(|conn| discard(conn)).unwrap();
        assert!(reopened.call(|conn| running(conn)).unwrap().is_none());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn deleting_the_linked_task_keeps_the_timer() {
        let db = Db::in_memory();
        db.call(|conn| {
            let task = tasks::create(conn, &tasks::input("Draft", None))?;
            start(conn, &details("", Some(task.id)))?;
            conn.execute("DELETE FROM task WHERE id = ?1", params![task.id])?;
            assert_eq!(running(conn)?.unwrap().task_id, None);
            Ok(())
        })
        .unwrap();
    }
}
