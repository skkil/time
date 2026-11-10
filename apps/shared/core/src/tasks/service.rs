use rusqlite::{Connection, params};

use super::model::{BlockMove, MoveResult, MoveTarget, Task, TaskInput, TaskPlacement, WEEK_DAYS};
use super::placement::{Container, place, resolve_container};
use super::queries::{descendants, get};
use super::rules::{on_first_occurrence, validate};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::recurrence::Recurrence;
use crate::types::{Date, Id};
use crate::validate::{ensure_changed, optional_text};
use crate::{blocks, time_entries, workflow};

pub fn create(conn: &Connection, env: &dyn MutationEnv, input: &TaskInput) -> Result<Task> {
    let input = &on_first_occurrence(input, env.today());
    let valid = validate(conn, None, input)?;
    let id = env.next_id();
    conn.execute(
        "INSERT INTO task (id, title, notes, priority, due_date, due_time, deadline, recurrence,
                           estimate_minutes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            valid.title,
            valid.notes,
            input.priority,
            input.due_date,
            input.due_time,
            input.deadline,
            valid.recurrence,
            input.estimate_minutes,
            env.timestamp()
        ],
    )?;
    place(conn, &id, &valid.container, None)?;
    workflow::reconcile(conn)?;
    conn.execute(
        "UPDATE task SET outcome_id = (SELECT p.outcome_id FROM task p WHERE p.id = task.parent_id)
         WHERE id = ?1 AND parent_id IS NOT NULL",
        params![id],
    )?;
    get(conn, &id)
}

pub fn update(conn: &Connection, id: &Id, input: &TaskInput) -> Result<Task> {
    let current = get(conn, id)?;
    let valid = validate(conn, Some(id), input)?;
    if current.kind == "event" && (input.due_date.is_none() || input.due_time.is_none()) {
        return Err(Error::invalid("Events need a date and a time."));
    }
    conn.execute(
        "UPDATE task SET title = ?1, notes = ?2, priority = ?3, due_date = ?4, due_time = ?5,
                         deadline = ?6, recurrence = ?7, estimate_minutes = ?8,
                         due_until = CASE WHEN due_date IS ?4 AND ?5 IS NULL AND ?7 IS NULL
                                          THEN due_until ELSE NULL END
         WHERE id = ?9",
        params![
            valid.title,
            valid.notes,
            input.priority,
            input.due_date,
            input.due_time,
            input.deadline,
            valid.recurrence,
            input.estimate_minutes,
            id
        ],
    )?;
    let previous = Container {
        project_id: current.project_id,
        section_id: current.section_id,
        parent_id: current.parent_id,
    };
    if previous != valid.container {
        place(conn, id, &valid.container, None)?;
        workflow::reconcile(conn)?;
    }
    get(conn, id)
}

pub fn move_to(conn: &Connection, id: &Id, placement: &TaskPlacement) -> Result<Task> {
    get(conn, id)?;
    let container = resolve_container(
        conn,
        Some(id),
        placement.project_id.as_ref(),
        placement.section_id.as_ref(),
        placement.parent_id.as_ref(),
    )?;
    place(conn, id, &container, placement.before.as_ref())?;
    workflow::reconcile(conn)?;
    get(conn, id)
}

pub fn reschedule(
    conn: &Connection,
    env: &dyn MutationEnv,
    ids: &[Id],
    due_date: Option<Date>,
) -> Result<()> {
    for id in ids {
        let rows = conn.execute(
            "UPDATE task SET rollover_count = rollover_count
                               + (due_date IS NOT NULL AND COALESCE(due_until, due_date) <= ?3
                                  AND ?1 > COALESCE(due_until, due_date)),
                             due_date = ?1,
                             due_until = NULL,
                             due_time = CASE WHEN ?1 IS NULL THEN NULL ELSE due_time END,
                             recurrence = CASE WHEN ?1 IS NULL THEN NULL ELSE recurrence END,
                             someday = CASE WHEN ?1 IS NULL THEN someday ELSE 0 END,
                             must_on = CASE WHEN must_on = ?1 THEN must_on ELSE NULL END
             WHERE id = ?2",
            params![due_date, id, env.today()],
        )?;
        ensure_changed(rows, "Task")?;
    }
    Ok(())
}

/// Moves tasks to a day, a week or Someday. With `BlockMove::Follow`, blocks
/// that haven't started shift by the same days as the date (whole weeks when
/// a week is involved), and moving to Someday removes them.
pub fn move_tasks(
    conn: &Connection,
    env: &dyn MutationEnv,
    ids: &[Id],
    target: MoveTarget,
    block_move: BlockMove,
) -> Result<MoveResult> {
    let (due_date, due_until) = match target {
        MoveTarget::Day { date } => (Some(date), None),
        MoveTarget::Week { monday } => {
            if monday.monday() != monday {
                return Err(Error::invalid("A week starts on a Monday."));
            }
            (Some(monday), Some(monday.add_days(WEEK_DAYS - 1)))
        }
        MoveTarget::Someday => (None, None),
    };
    let (now, today) = (env.timestamp(), env.today());
    let mut result = MoveResult::default();
    let mut seen = std::collections::HashSet::new();
    for id in ids.iter().filter(|id| seen.insert(*id)) {
        let task = get(conn, id)?;
        if !matches!(target, MoveTarget::Day { .. }) {
            if task.kind == "event" {
                return Err(Error::invalid(
                    "Events happen at a time; give them a new date.",
                ));
            }
            if task.recurrence.is_some() {
                return Err(Error::invalid("Repeating tasks move one day at a time."));
            }
        }
        let previous = task.due_until.or(task.due_date);
        let next = due_until.or(due_date);
        let rolled =
            matches!((previous, next), (Some(from), Some(to)) if from <= today && to > from);
        conn.execute(
            "UPDATE task SET rollover_count = rollover_count + ?1,
                             due_date = ?2,
                             due_until = ?3,
                             due_time = CASE WHEN ?2 IS NOT NULL AND ?3 IS NULL THEN due_time END,
                             recurrence = CASE WHEN ?2 IS NOT NULL THEN recurrence END,
                             someday = ?2 IS NULL,
                             must_on = CASE WHEN must_on BETWEEN ?2 AND COALESCE(?3, ?2)
                                            THEN must_on END
             WHERE id = ?4",
            params![rolled, due_date, due_until, id],
        )?;
        result.tasks += 1;
        if block_move == BlockMove::Leave {
            continue;
        }
        match (task.due_date, due_date) {
            (_, None) => result.blocks_removed += blocks::remove_upcoming(conn, id, now)?,
            (Some(from), Some(to)) => {
                let days = if due_until.is_some() || task.due_until.is_some() {
                    to.monday().days_since(from.monday())
                } else {
                    to.days_since(from)
                };
                if days != 0 {
                    result.blocks_moved += blocks::shift_upcoming(conn, id, now, days)?;
                }
            }
            (None, Some(_)) => {}
        }
    }
    Ok(result)
}

/// Stops a running timer tracking this task or anything nested under it.
pub fn stop_timer_within(conn: &Connection, env: &dyn MutationEnv, id: &Id) -> Result<()> {
    let mut tasks = descendants(conn, id)?;
    tasks.push(id.clone());
    time_entries::stop_for(conn, env, &tasks)
}

pub fn set_completed(
    conn: &Connection,
    env: &dyn MutationEnv,
    id: &Id,
    completed: bool,
) -> Result<Task> {
    let task = get(conn, id)?;
    if task.kind == "event" {
        return Err(Error::invalid(
            "Events happen at a time; they can't be checked off.",
        ));
    }
    if completed
        && let (Some(repeat), Some(due)) = (
            task.recurrence.as_deref().and_then(Recurrence::parse),
            task.due_date,
        )
        && let Some(next) = repeat.next_after(due.0, env.today().0)
    {
        conn.execute(
            "UPDATE task SET due_date = ?1 WHERE id = ?2",
            params![Date(next), id],
        )?;
        stop_timer_within(conn, env, id)?;
        return get(conn, id);
    }
    let completed_at = completed.then(|| env.timestamp());
    conn.execute(
        "UPDATE task SET completed_at = ?1 WHERE id = ?2",
        params![completed_at, id],
    )?;
    workflow::status_for_completion(conn, env, id, completed)?;
    if completed {
        for child in descendants(conn, id)? {
            conn.execute(
                "UPDATE task SET completed_at = ?1 WHERE id = ?2 AND completed_at IS NULL",
                params![completed_at, child],
            )?;
            workflow::status_for_completion(conn, env, &child, true)?;
        }
        stop_timer_within(conn, env, id)?;
    }
    get(conn, id)
}

pub fn set_outcome(conn: &Connection, id: &Id, outcome_id: Option<&Id>) -> Result<Task> {
    get(conn, id)?;
    for task in std::iter::once(id.clone()).chain(descendants(conn, id)?) {
        conn.execute(
            "UPDATE task SET outcome_id = ?1 WHERE id = ?2",
            params![outcome_id, task],
        )?;
    }
    get(conn, id)
}

pub fn set_someday(conn: &Connection, ids: &[Id], someday: bool) -> Result<()> {
    for id in ids {
        let rows = conn.execute(
            "UPDATE task SET someday = ?1,
                             due_date = CASE WHEN ?1 THEN NULL ELSE due_date END,
                             due_until = CASE WHEN ?1 THEN NULL ELSE due_until END,
                             due_time = CASE WHEN ?1 THEN NULL ELSE due_time END,
                             recurrence = CASE WHEN ?1 THEN NULL ELSE recurrence END,
                             must_on = CASE WHEN ?1 THEN NULL ELSE must_on END
             WHERE id = ?2",
            params![someday, id],
        )?;
        ensure_changed(rows, "Task")?;
    }
    Ok(())
}

pub fn set_must(conn: &Connection, id: &Id, must_on: Option<Date>) -> Result<Task> {
    let rows = conn.execute(
        "UPDATE task SET must_on = ?1,
                         due_date = CASE WHEN ?1 IS NULL OR due_date <= ?1 THEN due_date ELSE ?1 END,
                         someday = CASE WHEN ?1 IS NULL THEN someday ELSE 0 END
         WHERE id = ?2",
        params![must_on, id],
    )?;
    ensure_changed(rows, "Task")?;
    get(conn, id)
}

pub fn set_next_step(conn: &Connection, id: &Id, next_step: &str) -> Result<Task> {
    let next_step = optional_text(next_step, "Next step", 500)?;
    let rows = conn.execute(
        "UPDATE task SET next_step = ?1 WHERE id = ?2",
        params![next_step, id],
    )?;
    ensure_changed(rows, "Task")?;
    get(conn, id)
}

pub fn delete_many(conn: &Connection, ids: &[Id]) -> Result<()> {
    for id in ids {
        conn.execute("DELETE FROM task WHERE id = ?1", params![id])?;
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: &Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM task WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Task")
}
