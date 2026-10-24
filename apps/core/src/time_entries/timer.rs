use rusqlite::{Connection, OptionalExtension, params};

use super::model::{EntryDetails, EntryInput, MAX_ENTRY_SECONDS, RunningTimer, TimeEntry};
use super::rules::resolve;
use super::service::create;
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::types::{Id, Timestamp};

pub fn running(conn: &Connection) -> Result<Option<RunningTimer>> {
    Ok(conn
        .query_row(
            "SELECT description, project_id, task_id, started_at, paused_at, banked_seconds
             FROM running_timer WHERE id = 1",
            [],
            |row| {
                Ok(RunningTimer {
                    description: row.get(0)?,
                    project_id: row.get(1)?,
                    task_id: row.get(2)?,
                    started_at: row.get(3)?,
                    paused_at: row.get(4)?,
                    banked_seconds: row.get(5)?,
                })
            },
        )
        .optional()?)
}

fn save_running(conn: &Connection, running: &RunningTimer) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO running_timer
           (id, description, project_id, task_id, started_at, paused_at, banked_seconds)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            running.description,
            running.project_id,
            running.task_id,
            running.started_at,
            running.paused_at,
            running.banked_seconds
        ],
    )?;
    Ok(())
}

fn clear_running(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM running_timer", [])?;
    Ok(())
}

fn no_timer() -> Error {
    Error::invalid("No timer is running.")
}

/// Logs the current stretch of a running (not paused) timer as an entry,
/// capped at a day.
fn finish(
    conn: &Connection,
    env: &dyn MutationEnv,
    running: RunningTimer,
) -> Result<Option<TimeEntry>> {
    if running.paused_at.is_some() {
        return Ok(None);
    }
    let ended_at = env.timestamp();
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
    create(conn, env, &input).map(Some)
}

pub fn start(
    conn: &Connection,
    env: &dyn MutationEnv,
    details: &EntryDetails,
) -> Result<RunningTimer> {
    let details = resolve(conn, details)?;
    if let Some(previous) = running(conn)? {
        finish(conn, env, previous)?;
    }
    let next = RunningTimer {
        description: details.description,
        project_id: details.project_id,
        task_id: details.task_id,
        started_at: env.timestamp(),
        paused_at: None,
        banked_seconds: 0,
    };
    save_running(conn, &next)?;
    Ok(next)
}

pub fn pause(conn: &Connection, env: &dyn MutationEnv) -> Result<RunningTimer> {
    let mut current = running(conn)?.ok_or_else(no_timer)?;
    if current.paused_at.is_some() {
        return Ok(current);
    }
    let now = env.timestamp();
    if let Some(entry) = finish(conn, env, current.clone())? {
        current.banked_seconds += entry.started_at.seconds_until(entry.ended_at);
    }
    current.paused_at = Some(now);
    save_running(conn, &current)?;
    Ok(current)
}

pub fn resume(conn: &Connection, env: &dyn MutationEnv) -> Result<RunningTimer> {
    let mut current = running(conn)?.ok_or_else(no_timer)?;
    if current.paused_at.take().is_some() {
        current.started_at = env.timestamp();
        save_running(conn, &current)?;
    }
    Ok(current)
}

pub fn edit_running(conn: &Connection, details: &EntryDetails) -> Result<RunningTimer> {
    let details = resolve(conn, details)?;
    let mut current = running(conn)?.ok_or_else(no_timer)?;
    current.description = details.description;
    current.project_id = details.project_id;
    current.task_id = details.task_id;
    save_running(conn, &current)?;
    Ok(current)
}

pub fn stop(conn: &Connection, env: &dyn MutationEnv) -> Result<Option<TimeEntry>> {
    let Some(current) = running(conn)? else {
        return Ok(None);
    };
    let entry = finish(conn, env, current)?;
    clear_running(conn)?;
    Ok(entry)
}

/// Stops the timer if it tracks one of `tasks`.
pub fn stop_for(conn: &Connection, env: &dyn MutationEnv, tasks: &[Id]) -> Result<()> {
    let tracking = running(conn)?.is_some_and(|current| {
        current
            .task_id
            .is_some_and(|task_id| tasks.contains(&task_id))
    });
    if tracking {
        stop(conn, env)?;
    }
    Ok(())
}

pub fn discard(conn: &Connection) -> Result<()> {
    clear_running(conn)
}

pub fn restore_running(conn: &Connection, timer: &RunningTimer) -> Result<RunningTimer> {
    if running(conn)?.is_some() {
        return Err(Error::invalid(
            "Another timer is running, so this can't be undone.",
        ));
    }
    save_running(conn, timer)?;
    Ok(timer.clone())
}
