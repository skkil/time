use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, optional_text, required_text};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Date, Id, Timestamp};

pub const COLORS: [&str; 8] = [
    "graphite", "blue", "teal", "green", "olive", "amber", "rust", "plum",
];
pub const MAX_DEPTH: i64 = 3;
pub const VIEWS: [&str; 2] = ["list", "board"];
pub const KINDS: [&str; 2] = ["project", "area"];
pub const STATUSES: [&str; 4] = ["active", "paused", "done", "dropped"];
pub const REVIEW_WEEKS: [i32; 3] = [1, 2, 4];

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Id,
    pub parent_id: Option<Id>,
    pub name: String,
    pub color: String,
    pub position: i32,
    pub archived: bool,
    pub view: String,
    pub kind: String,
    pub status: String,
    pub outcome: String,
    pub weekly_minutes: Option<i32>,
    pub target_date: Option<Date>,
    pub kill_criteria: String,
    pub review_every_weeks: i32,
    pub last_reviewed_at: Option<Timestamp>,
    pub in_order: bool,
    pub preset: String,
    pub milestone_label: String,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub kind: String,
    pub status: String,
    pub outcome: String,
    pub weekly_minutes: Option<i32>,
    pub target_date: Option<Date>,
    pub kill_criteria: String,
    pub review_every_weeks: i32,
    pub in_order: bool,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    pub parent_id: Option<Id>,
    pub color: String,
}

const SELECT: &str = "SELECT id, parent_id, name, color, position, archived, view, kind, status,
       outcome, weekly_minutes, target_date, kill_criteria, review_every_weeks, last_reviewed_at,
       in_order, preset, milestone_label
     FROM project";

fn from_row(row: &Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        name: row.get(2)?,
        color: row.get(3)?,
        position: row.get(4)?,
        archived: row.get(5)?,
        view: row.get(6)?,
        kind: row.get(7)?,
        status: row.get(8)?,
        outcome: row.get(9)?,
        weekly_minutes: row.get(10)?,
        target_date: row.get(11)?,
        kill_criteria: row.get(12)?,
        review_every_weeks: row.get(13)?,
        last_reviewed_at: row.get(14)?,
        in_order: row.get(15)?,
        preset: row.get(16)?,
        milestone_label: row.get(17)?,
    })
}

pub fn get(conn: &Connection, id: Id) -> Result<Project> {
    conn.query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Project"))
}

pub fn list(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY position, id"))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn depth(conn: &Connection, id: Id) -> Result<i64> {
    Ok(conn.query_row(
        "WITH RECURSIVE up(id, parent_id, depth) AS (
           SELECT id, parent_id, 1 FROM project WHERE id = ?1
           UNION ALL
           SELECT p.id, p.parent_id, up.depth + 1 FROM project p JOIN up ON p.id = up.parent_id
         )
         SELECT MAX(depth) FROM up",
        params![id],
        |row| row.get(0),
    )?)
}

fn subtree(conn: &Connection, id: Id) -> Result<Vec<(Id, i64)>> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE down(id, depth) AS (
           SELECT id, 1 FROM project WHERE id = ?1
           UNION ALL
           SELECT p.id, down.depth + 1 FROM project p JOIN down ON p.parent_id = down.id
         )
         SELECT id, depth FROM down",
    )?;
    let rows = stmt.query_map(params![id], |row| Ok((row.get(0)?, row.get(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn validate(conn: &Connection, input: &ProjectInput, moving: Option<Id>) -> Result<String> {
    let name = required_text(&input.name, "Project name", 120)?;
    if !COLORS.contains(&input.color.as_str()) {
        return Err(Error::invalid(format!("Unknown color: {}", input.color)));
    }
    let Some(parent_id) = input.parent_id else {
        return Ok(name);
    };

    let parent = get(conn, parent_id)?;
    if parent.archived {
        return Err(Error::invalid("Can't add to an archived project."));
    }

    let height = match moving {
        Some(id) => {
            let descendants = subtree(conn, id)?;
            if descendants
                .iter()
                .any(|(descendant, _)| *descendant == parent_id)
            {
                return Err(Error::invalid("A project can't move inside itself."));
            }
            descendants
                .iter()
                .map(|(_, depth)| *depth)
                .max()
                .unwrap_or(1)
        }
        None => 1,
    };
    if depth(conn, parent_id)? + height > MAX_DEPTH {
        return Err(Error::invalid(format!(
            "Projects nest at most {MAX_DEPTH} levels deep."
        )));
    }
    Ok(name)
}

pub fn create(conn: &Connection, input: &ProjectInput) -> Result<Project> {
    let name = validate(conn, input, None)?;
    conn.execute(
        "INSERT INTO project (parent_id, name, color, position, kind, review_every_weeks)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(position), 0) + 1 FROM project), 'project', 1)",
        params![input.parent_id, name, input.color],
    )?;
    get(conn, Id(conn.last_insert_rowid()))
}

pub fn update(conn: &Connection, id: Id, input: &ProjectInput) -> Result<Project> {
    let current = get(conn, id)?;
    let moving = (current.parent_id != input.parent_id).then_some(id);
    let name = validate(conn, input, moving)?;
    conn.execute(
        "UPDATE project SET parent_id = ?1, name = ?2, color = ?3 WHERE id = ?4",
        params![input.parent_id, name, input.color, id],
    )?;
    get(conn, id)
}

pub fn set_archived(conn: &mut Connection, id: Id, archived: bool) -> Result<()> {
    let tx = conn.transaction()?;
    let ids = subtree(&tx, id)?;
    if ids.is_empty() {
        return Err(Error::not_found("Project"));
    }
    if !archived
        && let Some(parent_id) = get(&tx, id)?.parent_id
        && get(&tx, parent_id)?.archived
    {
        return Err(Error::invalid("Restore the parent project first."));
    }
    for (project_id, _) in ids {
        tx.execute(
            "UPDATE project SET archived = ?1 WHERE id = ?2",
            params![archived, project_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn set_view(conn: &Connection, id: Id, view: &str) -> Result<Project> {
    if !VIEWS.contains(&view) {
        return Err(Error::invalid(format!("Unknown view: {view}")));
    }
    let rows = conn.execute(
        "UPDATE project SET view = ?1 WHERE id = ?2",
        params![view, id],
    )?;
    ensure_changed(rows, "Project")?;
    get(conn, id)
}

pub fn update_settings(conn: &Connection, id: Id, settings: &ProjectSettings) -> Result<Project> {
    let current = get(conn, id)?;
    if !KINDS.contains(&settings.kind.as_str()) {
        return Err(Error::invalid(format!("Unknown kind: {}", settings.kind)));
    }
    if !STATUSES.contains(&settings.status.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown status: {}",
            settings.status
        )));
    }
    if settings.kind == "area" && matches!(settings.status.as_str(), "done" | "dropped") {
        return Err(Error::invalid("Areas don't finish; pause them instead."));
    }
    if !REVIEW_WEEKS.contains(&settings.review_every_weeks) {
        return Err(Error::invalid("Review every 1, 2 or 4 weeks."));
    }
    if let Some(minutes) = settings.weekly_minutes
        && !(1..=7 * 24 * 60).contains(&minutes)
    {
        return Err(Error::invalid("Weekly time must be within a week."));
    }
    if settings.kind == "area"
        && let Some(parent_id) = current.parent_id
        && get(conn, parent_id)?.kind == "project"
    {
        return Err(Error::invalid("An area can't sit inside a project."));
    }
    if settings.kind == "project"
        && conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM project WHERE parent_id = ?1 AND kind = 'area')",
            params![id],
            |row| row.get::<_, bool>(0),
        )?
    {
        return Err(Error::invalid("Move the areas inside it out first."));
    }
    let outcome = optional_text(&settings.outcome, "Outcome", 300)?;
    let kill_criteria = optional_text(&settings.kill_criteria, "Stop rule", 300)?;
    conn.execute(
        "UPDATE project SET kind = ?1, status = ?2, outcome = ?3, weekly_minutes = ?4,
                            target_date = ?5, kill_criteria = ?6, review_every_weeks = ?7,
                            in_order = ?8
         WHERE id = ?9",
        params![
            settings.kind,
            settings.status,
            outcome,
            settings.weekly_minutes,
            settings.target_date,
            kill_criteria,
            settings.review_every_weeks,
            settings.in_order,
            id
        ],
    )?;
    get(conn, id)
}

pub fn mark_reviewed(conn: &Connection, id: Id) -> Result<Project> {
    let rows = conn.execute(
        "UPDATE project SET last_reviewed_at = ?1 WHERE id = ?2",
        params![Timestamp::now(), id],
    )?;
    ensure_changed(rows, "Project")?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM project WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Project")
}

#[tauri::command]
#[specta::specta]
pub async fn list_projects(db: State<'_, Db>) -> Result<Vec<Project>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_project(db: State<'_, Db>, input: ProjectInput) -> Result<Project> {
    db.call(|conn| create(conn, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_project(db: State<'_, Db>, id: Id, input: ProjectInput) -> Result<Project> {
    db.call(|conn| update(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_archived(db: State<'_, Db>, id: Id, archived: bool) -> Result<()> {
    db.call(|conn| set_archived(conn, id, archived))
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_view(db: State<'_, Db>, id: Id, view: String) -> Result<Project> {
    db.call(|conn| set_view(conn, id, &view))
}

#[tauri::command]
#[specta::specta]
pub async fn update_project_settings(
    db: State<'_, Db>,
    id: Id,
    settings: ProjectSettings,
) -> Result<Project> {
    db.call(|conn| update_settings(conn, id, &settings))
}

#[tauri::command]
#[specta::specta]
pub async fn mark_project_reviewed(db: State<'_, Db>, id: Id) -> Result<Project> {
    db.call(|conn| mark_reviewed(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_project(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete(conn, id))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(name: &str, parent_id: Option<Id>) -> ProjectInput {
        ProjectInput {
            name: name.into(),
            parent_id,
            color: "blue".into(),
        }
    }

    #[test]
    fn nests_up_to_three_levels() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = create(conn, &input("School", None))?;
            let b = create(conn, &input("Algorithms", Some(a.id)))?;
            let c = create(conn, &input("Homework", Some(b.id)))?;
            assert!(matches!(
                create(conn, &input("Too deep", Some(c.id))),
                Err(Error::Invalid(_))
            ));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn refuses_cycles_and_deep_moves() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = create(conn, &input("A", None))?;
            let b = create(conn, &input("B", Some(a.id)))?;
            let other = create(conn, &input("Other", None))?;
            let other_child = create(conn, &input("Other child", Some(other.id)))?;

            assert!(update(conn, a.id, &input("A", Some(b.id))).is_err());
            assert!(update(conn, a.id, &input("A", Some(other_child.id))).is_err());
            assert_eq!(
                update(conn, a.id, &input("A", Some(other.id)))?.parent_id,
                Some(other.id)
            );
            Ok(())
        })
        .unwrap();
    }

    fn settings(kind: &str, status: &str) -> ProjectSettings {
        ProjectSettings {
            kind: kind.into(),
            status: status.into(),
            outcome: String::new(),
            weekly_minutes: Some(360),
            target_date: None,
            kill_criteria: String::new(),
            review_every_weeks: 1,
            in_order: false,
        }
    }

    #[test]
    fn projects_sit_under_areas_not_the_reverse() {
        let db = Db::in_memory();
        db.call(|conn| {
            let health = create(conn, &input("Health", None))?;
            update_settings(conn, health.id, &settings("area", "active"))?;
            let run = create(conn, &input("Half marathon", Some(health.id)))?;
            assert_eq!(run.kind, "project");
            let inner = create(conn, &input("Training plan", Some(run.id)))?;
            assert!(update_settings(conn, inner.id, &settings("area", "active")).is_err());
            assert!(update_settings(conn, health.id, &settings("area", "done")).is_err());
            let done = update_settings(conn, run.id, &settings("project", "done"))?;
            assert_eq!(done.weekly_minutes, Some(360));
            assert!(mark_reviewed(conn, run.id)?.last_reviewed_at.is_some());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn archives_and_deletes_whole_subtree() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = create(conn, &input("A", None))?;
            let b = create(conn, &input("B", Some(a.id)))?;
            set_archived(conn, a.id, true)?;
            assert!(get(conn, b.id)?.archived);
            assert!(set_archived(conn, b.id, false).is_err());

            delete(conn, a.id)?;
            assert!(list(conn)?.is_empty());
            Ok(())
        })
        .unwrap();
    }
}
