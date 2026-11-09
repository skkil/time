use rusqlite::{Connection, params};

use crate::env::MutationEnv;
use crate::error::Result;
use crate::types::Id;

/// Re-points types, statuses, phases and milestones of tasks that moved to
/// another project at that project's equivalents (by name, then category),
/// and gives unstatused tasks in structured projects a status.
pub fn reconcile(conn: &Connection) -> Result<()> {
    conn.execute(
        "UPDATE task SET type_id = (
           SELECT n.id FROM item_type n JOIN item_type o ON o.id = task.type_id
            WHERE n.project_id = task.project_id AND n.name = o.name)
         WHERE type_id IS NOT NULL
           AND (SELECT project_id FROM item_type WHERE id = task.type_id) IS NOT task.project_id",
        [],
    )?;
    conn.execute(
        "UPDATE OR IGNORE record_phase SET status_id = (
           SELECT n.id FROM item_status n
             JOIN item_status o ON o.id = record_phase.status_id
             JOIN task t ON t.id = record_phase.task_id
            WHERE n.project_id = t.project_id AND n.name = o.name
            ORDER BY n.position, n.id LIMIT 1)
         WHERE (SELECT project_id FROM item_status WHERE id = record_phase.status_id)
               IS NOT (SELECT project_id FROM task WHERE id = record_phase.task_id)
           AND EXISTS (
             SELECT 1 FROM item_status n
               JOIN item_status o ON o.id = record_phase.status_id
               JOIN task t ON t.id = record_phase.task_id
              WHERE n.project_id = t.project_id AND n.name = o.name)",
        [],
    )?;
    conn.execute(
        "UPDATE task SET phase_id = (
           SELECT n.id FROM item_status n JOIN item_status o ON o.id = task.phase_id
            WHERE n.project_id = task.project_id AND n.name = o.name
            ORDER BY n.position, n.id LIMIT 1)
         WHERE phase_id IS NOT NULL
           AND (SELECT project_id FROM item_status WHERE id = task.phase_id) IS NOT task.project_id",
        [],
    )?;
    conn.execute(
        "UPDATE task SET milestone_id = NULL
         WHERE milestone_id IS NOT NULL
           AND (SELECT project_id FROM milestone WHERE id = task.milestone_id) IS NOT task.project_id",
        [],
    )?;
    conn.execute(
        "UPDATE task SET status_id = (
           SELECT n.id FROM item_status n JOIN item_status o ON o.id = task.status_id
            WHERE n.project_id = task.project_id AND n.category = o.category
            ORDER BY n.position, n.id LIMIT 1)
         WHERE status_id IS NOT NULL
           AND (SELECT project_id FROM item_status WHERE id = task.status_id) IS NOT task.project_id",
        [],
    )?;
    conn.execute(
        "UPDATE task SET status_id = (
           SELECT s.id FROM item_status s
            WHERE s.project_id = task.project_id
            ORDER BY CASE
              WHEN task.completed_at IS NOT NULL THEN s.category != 'done'
              ELSE s.category != 'todo' END,
              s.category IN ('done', 'dropped'), s.position, s.id
            LIMIT 1)
         WHERE status_id IS NULL AND project_id IS NOT NULL",
        [],
    )?;
    Ok(())
}

/// Keeps `completed_at` in step with each matching task's status category.
pub fn sync_completion(
    conn: &Connection,
    env: &dyn MutationEnv,
    filter: &str,
    args: impl rusqlite::Params,
) -> Result<()> {
    conn.execute(
        &format!(
            "UPDATE task SET completed_at = CASE
               WHEN (SELECT category FROM item_status WHERE id = task.status_id) IN ('done', 'dropped')
                 THEN COALESCE(completed_at, {now})
               ELSE NULL END
             WHERE status_id IS NOT NULL AND {filter}",
            now = env.timestamp().0
        ),
        args,
    )?;
    Ok(())
}

/// Moves a task to its project's first done (or open) status when it is
/// checked off (or reopened).
pub fn status_for_completion(
    conn: &Connection,
    env: &dyn MutationEnv,
    task_id: &Id,
    completed: bool,
) -> Result<()> {
    let wanted = if completed {
        "'done'"
    } else {
        "'todo', 'active', 'backlog'"
    };
    conn.execute(
        &format!(
            "UPDATE task SET status_id = (
               SELECT s.id FROM item_status s
                WHERE s.project_id = task.project_id AND s.category IN ({wanted})
                ORDER BY s.category != {first}, s.position, s.id LIMIT 1),
               status_changed_at = ?2
             WHERE id = ?1
               AND EXISTS (SELECT 1 FROM item_status s WHERE s.project_id = task.project_id)
               AND COALESCE((SELECT category FROM item_status WHERE id = task.status_id)
                     IN ('done', 'dropped'), 0) != ?3",
            first = if completed { "'done'" } else { "'todo'" }
        ),
        params![task_id, env.timestamp(), completed],
    )?;
    Ok(())
}
