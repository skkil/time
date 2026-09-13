use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, optional_text, projects, required_text, sections, workflow};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::recurrence::Rule;
use crate::types::{Date, Id, Seconds, Timestamp};

const MAX_ESTIMATE_MINUTES: i32 = 24 * 60;
const COMPLETED_HISTORY_DAYS: i64 = 14;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: Id,
    pub title: String,
    pub notes: String,
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub priority: i32,
    pub due_date: Option<Date>,
    pub due_time: Option<i32>,
    pub deadline: Option<Date>,
    pub recurrence: Option<String>,
    pub estimate_minutes: Option<i32>,
    pub position: i32,
    pub completed_at: Option<Timestamp>,
    pub created_at: Timestamp,
    pub tracked_seconds: Seconds,
    pub outcome_id: Option<Id>,
    pub rollover_count: i32,
    pub someday: bool,
    pub next_step: String,
    pub must_on: Option<Date>,
    pub type_id: Option<Id>,
    pub status_id: Option<Id>,
    pub milestone_id: Option<Id>,
    pub location: String,
    pub counts_as_time: bool,
    pub status_changed_at: Option<Timestamp>,
    pub kind: String,
    pub status_category: Option<String>,
    pub blocked_by: Vec<Id>,
    pub waiting_on: Vec<Id>,
    pub phase_id: Option<Id>,
}

#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub notes: String,
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub priority: i32,
    pub due_date: Option<Date>,
    pub due_time: Option<i32>,
    pub deadline: Option<Date>,
    pub recurrence: Option<String>,
    pub estimate_minutes: Option<i32>,
}

#[derive(Debug, Clone, Copy, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TaskPlacement {
    pub project_id: Option<Id>,
    pub section_id: Option<Id>,
    pub parent_id: Option<Id>,
    pub before: Option<Id>,
}

const SELECT: &str = "SELECT t.id, t.title, t.notes, t.project_id, t.section_id, t.parent_id,
       t.priority, t.due_date, t.due_time, t.deadline, t.recurrence, t.estimate_minutes,
       t.position, t.completed_at, t.created_at,
       (SELECT COALESCE(SUM(e.ended_at - e.started_at), 0) FROM time_entry e WHERE e.task_id = t.id),
       t.outcome_id, t.rollover_count, t.someday, t.next_step, t.must_on,
       t.type_id, t.status_id, t.milestone_id, t.location, t.counts_as_time, t.status_changed_at,
       COALESCE((SELECT ty.kind FROM item_type ty WHERE ty.id = t.type_id), 'task'),
       (SELECT st.category FROM item_status st WHERE st.id = t.status_id),
       (SELECT GROUP_CONCAT(d.blocked_by_id) FROM task_dependency d WHERE d.task_id = t.id),
       (SELECT GROUP_CONCAT(d.blocked_by_id) FROM task_dependency d
          JOIN task b ON b.id = d.blocked_by_id
         WHERE d.task_id = t.id AND b.completed_at IS NULL),
       t.phase_id
     FROM task t";

fn ids(list: Option<String>) -> Vec<Id> {
    list.iter()
        .flat_map(|list| list.split(','))
        .filter_map(|id| id.parse().ok().map(Id))
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
        rollover_count: row.get(17)?,
        someday: row.get(18)?,
        next_step: row.get(19)?,
        must_on: row.get(20)?,
        type_id: row.get(21)?,
        status_id: row.get(22)?,
        milestone_id: row.get(23)?,
        location: row.get(24)?,
        counts_as_time: row.get(25)?,
        status_changed_at: row.get(26)?,
        kind: row.get(27)?,
        status_category: row.get(28)?,
        blocked_by: ids(row.get(29)?),
        waiting_on: ids(row.get(30)?),
        phase_id: row.get(31)?,
    })
}

pub fn get(conn: &Connection, id: Id) -> Result<Task> {
    conn.query_row(&format!("{SELECT} WHERE t.id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Task"))
}

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

fn descendants(conn: &Connection, id: Id) -> Result<Vec<Id>> {
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

#[derive(Debug, Clone, Copy, PartialEq)]
struct Container {
    project_id: Option<Id>,
    section_id: Option<Id>,
    parent_id: Option<Id>,
}

fn resolve_container(
    conn: &Connection,
    moving: Option<Id>,
    project_id: Option<Id>,
    section_id: Option<Id>,
    parent_id: Option<Id>,
) -> Result<Container> {
    if let Some(parent_id) = parent_id {
        let parent = get(conn, parent_id)?;
        if let Some(id) = moving
            && (parent_id == id || descendants(conn, id)?.contains(&parent_id))
        {
            return Err(Error::invalid("A task can't become its own sub-task."));
        }
        return Ok(Container {
            project_id: parent.project_id,
            section_id: parent.section_id,
            parent_id: Some(parent_id),
        });
    }
    if let Some(project_id) = project_id
        && projects::get(conn, project_id)?.archived
    {
        return Err(Error::invalid("Can't add tasks to an archived project."));
    }
    if let Some(section_id) = section_id
        && sections::get(conn, section_id)?.project_id != project_id
    {
        return Err(Error::invalid("That section belongs to another project."));
    }
    Ok(Container {
        project_id,
        section_id,
        parent_id: None,
    })
}

struct Valid {
    title: String,
    notes: String,
    container: Container,
    recurrence: Option<String>,
}

fn validate(conn: &Connection, moving: Option<Id>, input: &TaskInput) -> Result<Valid> {
    let title = required_text(&input.title, "Task title", 500)?;
    let notes = optional_text(&input.notes, "Description", 10_000)?;
    if !(1..=4).contains(&input.priority) {
        return Err(Error::invalid("Priority must be between 1 and 4."));
    }
    if let Some(minutes) = input.estimate_minutes
        && !(1..=MAX_ESTIMATE_MINUTES).contains(&minutes)
    {
        return Err(Error::invalid(
            "Duration must be between 1 minute and 24 hours.",
        ));
    }
    if let Some(time) = input.due_time {
        if input.due_date.is_none() {
            return Err(Error::invalid("A time needs a date."));
        }
        if !(0..24 * 60).contains(&time) {
            return Err(Error::invalid("Time must be within the day."));
        }
    }
    let recurrence = match input.recurrence.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(text) => {
            let rule = Rule::parse(text)
                .ok_or_else(|| Error::invalid(format!("Can't repeat “{text}”.")))?;
            if input.due_date.is_none() {
                return Err(Error::invalid("Repeating tasks need a date."));
            }
            Some(rule.to_string())
        }
    };
    let container = resolve_container(
        conn,
        moving,
        input.project_id,
        input.section_id,
        input.parent_id,
    )?;
    Ok(Valid {
        title,
        notes,
        container,
        recurrence,
    })
}

fn siblings(conn: &Connection, container: Container, except: Id) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM task
         WHERE project_id IS ?1 AND section_id IS ?2 AND parent_id IS ?3 AND id != ?4
           AND completed_at IS NULL
         ORDER BY position, id",
    )?;
    let rows = stmt.query_map(
        params![
            container.project_id,
            container.section_id,
            container.parent_id,
            except
        ],
        |row| row.get(0),
    )?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn place(conn: &Connection, id: Id, container: Container, before: Option<Id>) -> Result<()> {
    let mut ids = siblings(conn, container, id)?;
    let index = before
        .and_then(|before| ids.iter().position(|other| *other == before))
        .unwrap_or(ids.len());
    ids.insert(index, id);
    for (position, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE task SET position = ?1 WHERE id = ?2",
            params![position as i64 + 1, id],
        )?;
    }
    conn.execute(
        "UPDATE task SET project_id = ?1, section_id = ?2, parent_id = ?3 WHERE id = ?4",
        params![
            container.project_id,
            container.section_id,
            container.parent_id,
            id
        ],
    )?;
    for child in descendants(conn, id)? {
        conn.execute(
            "UPDATE task SET project_id = ?1, section_id = ?2 WHERE id = ?3",
            params![container.project_id, container.section_id, child],
        )?;
    }
    Ok(())
}

pub fn create(conn: &mut Connection, input: &TaskInput) -> Result<Task> {
    let valid = validate(conn, None, input)?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO task (title, notes, priority, due_date, due_time, deadline, recurrence,
                           estimate_minutes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            valid.title,
            valid.notes,
            input.priority,
            input.due_date,
            input.due_time,
            input.deadline,
            valid.recurrence,
            input.estimate_minutes,
            Timestamp::now()
        ],
    )?;
    let id = Id(tx.last_insert_rowid());
    place(&tx, id, valid.container, None)?;
    workflow::reconcile(&tx)?;
    tx.execute(
        "UPDATE task SET outcome_id = (SELECT p.outcome_id FROM task p WHERE p.id = task.parent_id)
         WHERE id = ?1 AND parent_id IS NOT NULL",
        params![id],
    )?;
    tx.commit()?;
    get(conn, id)
}

pub fn update(conn: &mut Connection, id: Id, input: &TaskInput) -> Result<Task> {
    let current = get(conn, id)?;
    let valid = validate(conn, Some(id), input)?;
    if current.kind == "event" && (input.due_date.is_none() || input.due_time.is_none()) {
        return Err(Error::invalid("Events need a date and a time."));
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE task SET title = ?1, notes = ?2, priority = ?3, due_date = ?4, due_time = ?5,
                         deadline = ?6, recurrence = ?7, estimate_minutes = ?8
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
        place(&tx, id, valid.container, None)?;
        workflow::reconcile(&tx)?;
    }
    tx.commit()?;
    get(conn, id)
}

pub fn move_to(conn: &mut Connection, id: Id, placement: TaskPlacement) -> Result<Task> {
    get(conn, id)?;
    let container = resolve_container(
        conn,
        Some(id),
        placement.project_id,
        placement.section_id,
        placement.parent_id,
    )?;
    let tx = conn.transaction()?;
    place(&tx, id, container, placement.before)?;
    workflow::reconcile(&tx)?;
    tx.commit()?;
    get(conn, id)
}

pub fn reschedule(conn: &mut Connection, ids: &[Id], due_date: Option<Date>) -> Result<()> {
    let tx = conn.transaction()?;
    for id in ids {
        let rows = tx.execute(
            "UPDATE task SET rollover_count = rollover_count
                               + (due_date IS NOT NULL AND due_date <= ?3 AND ?1 > due_date),
                             due_date = ?1,
                             due_time = CASE WHEN ?1 IS NULL THEN NULL ELSE due_time END,
                             recurrence = CASE WHEN ?1 IS NULL THEN NULL ELSE recurrence END,
                             someday = CASE WHEN ?1 IS NULL THEN someday ELSE 0 END,
                             must_on = CASE WHEN must_on = ?1 THEN must_on ELSE NULL END
             WHERE id = ?2",
            params![due_date, id, Date::today()],
        )?;
        ensure_changed(rows, "Task")?;
    }
    tx.commit()?;
    Ok(())
}

pub fn set_completed(conn: &mut Connection, id: Id, completed: bool) -> Result<Task> {
    let task = get(conn, id)?;
    if task.kind == "event" {
        return Err(Error::invalid(
            "Events happen at a time; they can't be checked off.",
        ));
    }
    if completed
        && let (Some(rule), Some(due)) = (
            task.recurrence.as_deref().and_then(Rule::parse),
            task.due_date,
        )
    {
        let next = Date(rule.next_after(due.0, Date::today().0));
        conn.execute(
            "UPDATE task SET due_date = ?1 WHERE id = ?2",
            params![next, id],
        )?;
        return get(conn, id);
    }
    let tx = conn.transaction()?;
    let completed_at = completed.then(Timestamp::now);
    tx.execute(
        "UPDATE task SET completed_at = ?1 WHERE id = ?2",
        params![completed_at, id],
    )?;
    workflow::status_for_completion(&tx, id, completed)?;
    if completed {
        for child in descendants(&tx, id)? {
            tx.execute(
                "UPDATE task SET completed_at = ?1 WHERE id = ?2 AND completed_at IS NULL",
                params![completed_at, child],
            )?;
            workflow::status_for_completion(&tx, child, true)?;
        }
    }
    tx.commit()?;
    get(conn, id)
}

pub fn set_outcome(conn: &mut Connection, id: Id, outcome_id: Option<Id>) -> Result<Task> {
    get(conn, id)?;
    let tx = conn.transaction()?;
    for task in std::iter::once(id).chain(descendants(&tx, id)?) {
        tx.execute(
            "UPDATE task SET outcome_id = ?1 WHERE id = ?2",
            params![outcome_id, task],
        )?;
    }
    tx.commit()?;
    get(conn, id)
}

pub fn set_someday(conn: &mut Connection, ids: &[Id], someday: bool) -> Result<()> {
    let tx = conn.transaction()?;
    for id in ids {
        let rows = tx.execute(
            "UPDATE task SET someday = ?1,
                             due_date = CASE WHEN ?1 THEN NULL ELSE due_date END,
                             due_time = CASE WHEN ?1 THEN NULL ELSE due_time END,
                             recurrence = CASE WHEN ?1 THEN NULL ELSE recurrence END,
                             must_on = CASE WHEN ?1 THEN NULL ELSE must_on END
             WHERE id = ?2",
            params![someday, id],
        )?;
        ensure_changed(rows, "Task")?;
    }
    tx.commit()?;
    Ok(())
}

pub fn set_must(conn: &Connection, id: Id, must_on: Option<Date>) -> Result<Task> {
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

pub fn set_next_step(conn: &Connection, id: Id, next_step: &str) -> Result<Task> {
    let next_step = optional_text(next_step, "Next step", 500)?;
    let rows = conn.execute(
        "UPDATE task SET next_step = ?1 WHERE id = ?2",
        params![next_step, id],
    )?;
    ensure_changed(rows, "Task")?;
    get(conn, id)
}

pub fn delete_many(conn: &mut Connection, ids: &[Id]) -> Result<()> {
    let tx = conn.transaction()?;
    for id in ids {
        tx.execute("DELETE FROM task WHERE id = ?1", params![id])?;
    }
    tx.commit()?;
    Ok(())
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM task WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Task")
}

#[tauri::command]
#[specta::specta]
pub async fn list_tasks(db: State<'_, Db>) -> Result<Vec<Task>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_task(db: State<'_, Db>, input: TaskInput) -> Result<Task> {
    db.call(|conn| create(conn, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_task(db: State<'_, Db>, id: Id, input: TaskInput) -> Result<Task> {
    db.call(|conn| update(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn move_task(db: State<'_, Db>, id: Id, placement: TaskPlacement) -> Result<Task> {
    db.call(|conn| move_to(conn, id, placement))
}

#[tauri::command]
#[specta::specta]
pub async fn reschedule_tasks(
    db: State<'_, Db>,
    ids: Vec<Id>,
    due_date: Option<Date>,
) -> Result<()> {
    db.call(|conn| reschedule(conn, &ids, due_date))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_completed(db: State<'_, Db>, id: Id, completed: bool) -> Result<Task> {
    db.call(|conn| set_completed(conn, id, completed))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_outcome(db: State<'_, Db>, id: Id, outcome_id: Option<Id>) -> Result<Task> {
    db.call(|conn| set_outcome(conn, id, outcome_id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_tasks_someday(db: State<'_, Db>, ids: Vec<Id>, someday: bool) -> Result<()> {
    db.call(|conn| set_someday(conn, &ids, someday))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_must(db: State<'_, Db>, id: Id, must_on: Option<Date>) -> Result<Task> {
    db.call(|conn| set_must(conn, id, must_on))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_next_step(db: State<'_, Db>, id: Id, next_step: String) -> Result<Task> {
    db.call(|conn| set_next_step(conn, id, &next_step))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_tasks(db: State<'_, Db>, ids: Vec<Id>) -> Result<()> {
    db.call(|conn| delete_many(conn, &ids))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_task(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[cfg(test)]
pub fn input(title: &str, project_id: Option<Id>) -> TaskInput {
    TaskInput {
        title: title.into(),
        notes: String::new(),
        project_id,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::projects::{self, ProjectInput};
    use crate::features::sections;
    use crate::types::date;

    fn project(conn: &Connection, name: &str) -> Result<projects::Project> {
        projects::create(
            conn,
            &ProjectInput {
                name: name.into(),
                parent_id: None,
                color: "teal".into(),
            },
        )
    }

    #[test]
    fn hides_tasks_of_archived_projects() {
        let db = Db::in_memory();
        db.call(|conn| {
            let side = project(conn, "Side")?;
            create(conn, &input("Inbox task", None))?;
            create(conn, &input("Project task", Some(side.id)))?;
            projects::set_archived(conn, side.id, true)?;

            let titles: Vec<_> = list(conn)?.into_iter().map(|t| t.title).collect();
            assert_eq!(titles, vec!["Inbox task"]);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn validates_fields() {
        let db = Db::in_memory();
        db.call(|conn| {
            assert!(create(conn, &input("  ", None)).is_err());
            let mut long = input("Write", None);
            long.estimate_minutes = Some(MAX_ESTIMATE_MINUTES + 1);
            assert!(create(conn, &long).is_err());
            let mut timed = input("Call", None);
            timed.due_time = Some(600);
            assert!(create(conn, &timed).is_err());
            let mut repeating = input("Run", None);
            repeating.recurrence = Some("every day".into());
            assert!(create(conn, &repeating).is_err());
            repeating.due_date = Some(date("2026-11-02"));
            repeating.recurrence = Some("Daily".into());
            assert_eq!(
                create(conn, &repeating)?.recurrence.as_deref(),
                Some("every day")
            );
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn subtasks_follow_parent_and_complete_with_it() {
        let db = Db::in_memory();
        db.call(|conn| {
            let school = project(conn, "School")?;
            let week = sections::create(conn, Some(school.id), "Week 9", None)?;
            let mut parent = input("Homework 3", Some(school.id));
            parent.section_id = Some(week.id);
            let parent = create(conn, &parent)?;
            let mut child = input("Problem 1", None);
            child.parent_id = Some(parent.id);
            let child = create(conn, &child)?;
            assert_eq!(child.project_id, Some(school.id));
            assert_eq!(child.section_id, Some(week.id));

            let mut cycle = input("Homework 3", Some(school.id));
            cycle.parent_id = Some(child.id);
            assert!(update(conn, parent.id, &cycle).is_err());

            move_to(
                conn,
                parent.id,
                TaskPlacement {
                    project_id: None,
                    section_id: None,
                    parent_id: None,
                    before: None,
                },
            )?;
            assert_eq!(get(conn, child.id)?.project_id, None);

            set_completed(conn, parent.id, true)?;
            assert!(get(conn, child.id)?.completed_at.is_some());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rejects_sections_from_other_projects() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = project(conn, "A")?;
            let b = project(conn, "B")?;
            let section = sections::create(conn, Some(a.id), "Doing", None)?;
            let mut task = input("Mixed", Some(b.id));
            task.section_id = Some(section.id);
            assert!(matches!(create(conn, &task), Err(Error::Invalid(_))));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn orders_siblings() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = create(conn, &input("A", None))?;
            let b = create(conn, &input("B", None))?;
            let c = create(conn, &input("C", None))?;
            move_to(
                conn,
                c.id,
                TaskPlacement {
                    project_id: None,
                    section_id: None,
                    parent_id: None,
                    before: Some(a.id),
                },
            )?;
            let titles: Vec<_> = list(conn)?.into_iter().map(|t| t.title).collect();
            assert_eq!(titles, ["C", "A", "B"]);
            assert_eq!(get(conn, b.id)?.position, 3);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rescheduling_a_due_task_counts_a_rollover() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = Date::today();
            let mut task = input("Essay", None);
            task.due_date = Some(today.add_days(-1));
            let task = create(conn, &task)?;
            reschedule(conn, &[task.id], Some(today))?;
            reschedule(conn, &[task.id], Some(today.add_days(1)))?;
            assert_eq!(get(conn, task.id)?.rollover_count, 2);
            reschedule(conn, &[task.id], Some(today.add_days(5)))?;
            assert_eq!(get(conn, task.id)?.rollover_count, 2);

            set_someday(conn, &[task.id], true)?;
            let parked = get(conn, task.id)?;
            assert!(parked.someday);
            assert_eq!(parked.due_date, None);

            let must = set_must(conn, task.id, Some(today))?;
            assert!(!must.someday);
            assert_eq!(must.must_on, Some(today));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn completing_a_repeating_task_moves_it_forward() {
        let db = Db::in_memory();
        db.call(|conn| {
            let mut task = input("Lecture", None);
            task.due_date = Some(Date::today());
            task.recurrence = Some("every week".into());
            let task = create(conn, &task)?;
            let next = set_completed(conn, task.id, true)?;
            assert!(next.completed_at.is_none());
            assert_eq!(next.due_date, Some(Date::today().add_days(7)));
            Ok(())
        })
        .unwrap();
    }
}
