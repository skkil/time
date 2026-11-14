use rusqlite::{Connection, OptionalExtension, Row, params};

use super::model::{COMPLETED_HISTORY_DAYS, Task};
use crate::error::{Error, Result};
use crate::types::{Id, Timestamp};

const SELECT: &str = "SELECT t.id, t.title, t.notes, t.project_id, t.section_id, t.parent_id,
       t.priority, t.due_date, t.due_time, t.deadline, t.recurrence, t.estimate_minutes,
       t.position, t.completed_at, t.created_at,
       (SELECT COALESCE(SUM(e.ended_at - e.started_at), 0) FROM time_entry e WHERE e.task_id = t.id),
       t.outcome_id, t.next_step, t.must_on,
       t.type_id, t.status_id, t.milestone_id, t.location, t.counts_as_time, t.status_changed_at,
       COALESCE((SELECT ty.kind FROM item_type ty WHERE ty.id = t.type_id), 'task'),
       (SELECT st.category FROM item_status st WHERE st.id = t.status_id),
       (SELECT GROUP_CONCAT(d.blocked_by_id) FROM task_dependency d WHERE d.task_id = t.id),
       (SELECT GROUP_CONCAT(d.blocked_by_id) FROM task_dependency d
          JOIN task b ON b.id = d.blocked_by_id
         WHERE d.task_id = t.id AND b.completed_at IS NULL),
       t.phase_id, t.due_until, t.place_id
     FROM task t";

fn id_list(list: Option<String>) -> Vec<Id> {
    list.iter()
        .flat_map(|list| list.split(','))
        .filter_map(|id| Id::parse(id).ok())
        .collect()
}

fn from_row(row: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        notes: row.get(2)?,
        project_id: row.get(3)?,
        section_id: row.get(4)?,
        parent_id: row.get(5)?,
        priority: row.get(6)?,
        due_date: row.get(7)?,
        due_time: row.get(8)?,
        deadline: row.get(9)?,
        recurrence: row.get(10)?,
        estimate_minutes: row.get(11)?,
        position: row.get(12)?,
        completed_at: row.get(13)?,
        created_at: row.get(14)?,
        tracked_seconds: row.get(15)?,
        outcome_id: row.get(16)?,
        next_step: row.get(17)?,
        must_on: row.get(18)?,
        type_id: row.get(19)?,
        status_id: row.get(20)?,
        milestone_id: row.get(21)?,
        location: row.get(22)?,
        counts_as_time: row.get(23)?,
        status_changed_at: row.get(24)?,
        kind: row.get(25)?,
        status_category: row.get(26)?,
        blocked_by: id_list(row.get(27)?),
        waiting_on: id_list(row.get(28)?),
        phase_id: row.get(29)?,
        due_until: row.get(30)?,
        place_id: row.get(31)?,
    })
}

pub fn get(conn: &Connection, id: &Id) -> Result<Task> {
    conn.query_row(&format!("{SELECT} WHERE t.id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Task"))
}

/// Open tasks and those closed in the last two weeks, outside archived
/// projects.
pub fn list(conn: &Connection) -> Result<Vec<Task>> {
    let since = Timestamp(Timestamp::now().0 - COMPLETED_HISTORY_DAYS * Timestamp::DAY);
    let mut stmt = conn.prepare(&format!(
        "{SELECT}
         LEFT JOIN project p ON p.id = t.project_id
         WHERE (t.completed_at IS NULL OR t.completed_at >= ?1)
           AND (p.id IS NULL OR p.archived = 0)
         ORDER BY t.position, t.id"
    ))?;
    let rows = stmt.query_map(params![since], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Every task nested under `id`, at any depth.
pub fn descendants(conn: &Connection, id: &Id) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE down(id) AS (
           SELECT id FROM task WHERE parent_id = ?1
           UNION ALL
           SELECT t.id FROM task t JOIN down ON t.parent_id = down.id
         )
         SELECT id FROM down",
    )?;
    let rows = stmt.query_map(params![id], |row| row.get(0))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
