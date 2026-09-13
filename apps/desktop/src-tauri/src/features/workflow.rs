use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{Manager, State};

use super::{ensure_changed, optional_text, projects, required_text, tasks};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::recurrence::Rule;
use crate::types::{Date, Id, Seconds, Timestamp};

pub const CATEGORIES: [&str; 5] = ["backlog", "todo", "active", "done", "dropped"];
pub const KINDS: [&str; 3] = ["task", "event", "record"];
pub const LAYOUTS: [&str; 4] = ["list", "board", "calendar", "table"];
pub const GROUPS: [&str; 6] = ["section", "type", "status", "milestone", "date", "none"];
pub const SORTS: [&str; 6] = ["manual", "date", "deadline", "priority", "title", "created"];
pub const ICONS: [&str; 24] = [
    "circle",
    "square",
    "sparkles",
    "bug",
    "wrench",
    "git-pull-request",
    "users",
    "repeat",
    "book-open",
    "file-text",
    "pencil",
    "graduation-cap",
    "clipboard-check",
    "timer",
    "flag",
    "mail",
    "phone",
    "briefcase",
    "calendar",
    "target",
    "lightbulb",
    "bookmark",
    "message-circle",
    "presentation",
];
const DEFAULT_EVENT_MINUTES: i64 = 60;
const MAX_CHECKLIST: usize = 30;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ItemType {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub icon: String,
    pub kind: String,
    pub default_minutes: Option<i32>,
    pub checklist: String,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ItemTypeInput {
    pub name: String,
    pub icon: String,
    pub kind: String,
    pub default_minutes: Option<i32>,
    pub checklist: String,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ItemStatus {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub category: String,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct StatusInput {
    pub name: String,
    pub category: String,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Milestone {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub date: Option<Date>,
    pub position: i32,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneInput {
    pub name: String,
    pub date: Option<Date>,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedView {
    pub id: Id,
    pub project_id: Id,
    pub name: String,
    pub layout: String,
    pub group_by: String,
    pub filter: String,
    pub sort: String,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ViewInput {
    pub name: String,
    pub layout: String,
    pub group_by: String,
    pub filter: String,
    pub sort: String,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub types: Vec<ItemType>,
    pub statuses: Vec<ItemStatus>,
    pub milestones: Vec<Milestone>,
    pub views: Vec<SavedView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub key: String,
    pub name: String,
    pub description: String,
    pub types: Vec<ItemTypeInput>,
    pub statuses: Vec<StatusInput>,
    pub milestone_label: String,
    pub views: Vec<ViewInput>,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EventOccurrence {
    pub task_id: Id,
    pub title: String,
    pub project_id: Option<Id>,
    pub type_id: Option<Id>,
    pub start_at: Timestamp,
    pub end_at: Timestamp,
    pub location: String,
    pub counts_as_time: bool,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TypeTime {
    pub name: String,
    pub icon: String,
    pub seconds: Seconds,
}

fn kind_type(name: &str, icon: &str, kind: &str, minutes: Option<i32>) -> ItemTypeInput {
    ItemTypeInput {
        name: name.into(),
        icon: icon.into(),
        kind: kind.into(),
        default_minutes: minutes,
        checklist: String::new(),
    }
}

fn status(name: &str, category: &str) -> StatusInput {
    StatusInput {
        name: name.into(),
        category: category.into(),
    }
}

fn view(name: &str, layout: &str, group_by: &str, filter: &str, sort: &str) -> ViewInput {
    ViewInput {
        name: name.into(),
        layout: layout.into(),
        group_by: group_by.into(),
        filter: filter.into(),
        sort: sort.into(),
    }
}

pub fn presets() -> Vec<Preset> {
    vec![
        Preset {
            key: "simple".into(),
            name: "Simple".into(),
            description: "A plain list with sections. Nothing to set up.".into(),
            types: vec![],
            statuses: vec![],
            milestone_label: String::new(),
            views: vec![],
        },
        Preset {
            key: "software".into(),
            name: "Software".into(),
            description: "Features, bugs and reviews on a status board, releases as milestones."
                .into(),
            types: vec![
                kind_type("Feature", "sparkles", "task", None),
                kind_type("Bug", "bug", "task", None),
                kind_type("Chore", "wrench", "task", None),
                kind_type("PR review", "git-pull-request", "task", Some(30)),
                kind_type("Meeting", "users", "event", Some(60)),
                kind_type("Standup", "repeat", "event", Some(15)),
            ],
            statuses: vec![
                status("Backlog", "backlog"),
                status("Todo", "todo"),
                status("In progress", "active"),
                status("In review", "active"),
                status("Done", "done"),
                status("Canceled", "dropped"),
            ],
            milestone_label: "Releases".into(),
            views: vec![
                view(
                    "Board",
                    "board",
                    "status",
                    r#"{"hideBacklog":true}"#,
                    "manual",
                ),
                view(
                    "Backlog",
                    "list",
                    "none",
                    r#"{"categories":["backlog"]}"#,
                    "priority",
                ),
                view("By type", "list", "type", "{}", "manual"),
                view("Calendar", "calendar", "date", "{}", "date"),
            ],
        },
        Preset {
            key: "course".into(),
            name: "Course".into(),
            description: "Lectures on the calendar, readings and assignments by deadline.".into(),
            types: vec![
                kind_type("Lecture", "presentation", "event", Some(90)),
                kind_type("Reading", "book-open", "task", None),
                kind_type("Assignment", "file-text", "task", None),
                kind_type("Problem set", "pencil", "task", None),
                kind_type("Exam", "graduation-cap", "event", Some(120)),
                kind_type("Study session", "timer", "task", Some(50)),
            ],
            statuses: vec![
                status("To do", "todo"),
                status("Doing", "active"),
                status("Submitted", "done"),
                status("Dropped", "dropped"),
            ],
            milestone_label: "Exams".into(),
            views: vec![
                view("Week", "calendar", "date", "{}", "date"),
                view(
                    "Deadlines",
                    "table",
                    "none",
                    r#"{"hideDone":true}"#,
                    "deadline",
                ),
                view("By type", "list", "type", "{}", "manual"),
            ],
        },
        Preset {
            key: "writing".into(),
            name: "Writing".into(),
            description:
                "Chapters and drafts moving from outline to done, submissions as milestones.".into(),
            types: vec![
                kind_type("Chapter", "bookmark", "task", None),
                kind_type("Source", "book-open", "task", None),
                kind_type("Draft", "pencil", "task", None),
                kind_type("Supervisor meeting", "message-circle", "event", Some(60)),
            ],
            statuses: vec![
                status("Outline", "todo"),
                status("Drafting", "active"),
                status("Revising", "active"),
                status("Done", "done"),
                status("Cut", "dropped"),
            ],
            milestone_label: "Submissions".into(),
            views: vec![
                view("By status", "table", "status", "{}", "manual"),
                view("Board", "board", "status", "{}", "manual"),
            ],
        },
        Preset {
            key: "pipeline".into(),
            name: "Pipeline".into(),
            description: "Leads moving through stages, with days since each last moved.".into(),
            types: vec![
                kind_type("Lead", "target", "record", None),
                kind_type("Follow-up", "mail", "task", Some(15)),
                kind_type("Interview", "briefcase", "event", Some(60)),
            ],
            statuses: vec![
                status("Saved", "backlog"),
                status("Applied", "todo"),
                status("In progress", "active"),
                status("Won", "done"),
                status("Closed", "dropped"),
            ],
            milestone_label: String::new(),
            views: vec![view("Board", "board", "status", "{}", "manual")],
        },
        Preset {
            key: "job_search".into(),
            name: "Job search".into(),
            description: "One record per company, with its own tasks and notes for each phase."
                .into(),
            types: vec![
                kind_type("Application", "briefcase", "record", None),
                kind_type("Interview", "users", "event", Some(60)),
            ],
            statuses: vec![
                status("To apply", "backlog"),
                status("Applied", "todo"),
                status("Interviewing", "active"),
                status("Offer", "active"),
                status("Accepted", "done"),
                status("Closed", "dropped"),
            ],
            milestone_label: String::new(),
            views: vec![
                view("Board", "board", "status", "{}", "manual"),
                view("List", "list", "status", "{}", "manual"),
            ],
        },
    ]
}

fn one_of(value: &str, allowed: &[&str], what: &str) -> Result<()> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(Error::invalid(format!("Unknown {what}: {value}.")))
    }
}

fn check_type(input: &ItemTypeInput) -> Result<ItemTypeInput> {
    one_of(&input.kind, &KINDS, "kind")?;
    let icon = if ICONS.contains(&input.icon.as_str()) {
        input.icon.clone()
    } else {
        "circle".into()
    };
    if let Some(minutes) = input.default_minutes
        && !(1..=24 * 60).contains(&minutes)
    {
        return Err(Error::invalid("Default length is 1 minute to 24 hours."));
    }
    if input
        .checklist
        .lines()
        .filter(|l| !l.trim().is_empty())
        .count()
        > MAX_CHECKLIST
    {
        return Err(Error::invalid(format!(
            "A checklist has at most {MAX_CHECKLIST} items."
        )));
    }
    Ok(ItemTypeInput {
        name: required_text(&input.name, "Type name", 40)?,
        icon,
        kind: input.kind.clone(),
        default_minutes: input.default_minutes,
        checklist: optional_text(&input.checklist, "Checklist", 2000)?,
    })
}

fn check_view(input: &ViewInput) -> Result<ViewInput> {
    one_of(&input.layout, &LAYOUTS, "layout")?;
    one_of(&input.group_by, &GROUPS, "grouping")?;
    one_of(&input.sort, &SORTS, "sort")?;
    serde_json::from_str::<serde_json::Value>(&input.filter)
        .map_err(|_| Error::invalid("The view's filter isn't valid."))?;
    Ok(ViewInput {
        name: required_text(&input.name, "View name", 40)?,
        ..input.clone()
    })
}

fn type_row(row: &Row) -> rusqlite::Result<ItemType> {
    Ok(ItemType {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        icon: row.get(3)?,
        kind: row.get(4)?,
        default_minutes: row.get(5)?,
        checklist: row.get(6)?,
        position: row.get(7)?,
    })
}

pub fn get_type(conn: &Connection, id: Id) -> Result<ItemType> {
    conn.query_row(
        "SELECT id, project_id, name, icon, kind, default_minutes, checklist, position
           FROM item_type WHERE id = ?1",
        params![id],
        type_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Type"))
}

fn get_status(conn: &Connection, id: Id) -> Result<ItemStatus> {
    conn.query_row(
        "SELECT id, project_id, name, category, position FROM item_status WHERE id = ?1",
        params![id],
        |row| {
            Ok(ItemStatus {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                position: row.get(4)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Status"))
}

pub fn list(conn: &Connection) -> Result<Workflow> {
    let types = conn
        .prepare(
            "SELECT id, project_id, name, icon, kind, default_minutes, checklist, position
               FROM item_type ORDER BY project_id, position, id",
        )?
        .query_map([], type_row)?
        .collect::<rusqlite::Result<_>>()?;
    let statuses = conn
        .prepare(
            "SELECT id, project_id, name, category, position
               FROM item_status ORDER BY project_id, position, id",
        )?
        .query_map([], |row| {
            Ok(ItemStatus {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                category: row.get(3)?,
                position: row.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    let milestones = conn
        .prepare(
            "SELECT id, project_id, name, date, position
               FROM milestone ORDER BY project_id, date IS NULL, date, position, id",
        )?
        .query_map([], |row| {
            Ok(Milestone {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                date: row.get(3)?,
                position: row.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    let views = conn
        .prepare(
            "SELECT id, project_id, name, layout, group_by, filter, sort, position
               FROM saved_view ORDER BY project_id, position, id",
        )?
        .query_map([], |row| {
            Ok(SavedView {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                layout: row.get(3)?,
                group_by: row.get(4)?,
                filter: row.get(5)?,
                sort: row.get(6)?,
                position: row.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(Workflow {
        types,
        statuses,
        milestones,
        views,
    })
}

fn next_position(conn: &Connection, table: &str, project_id: Id) -> Result<i32> {
    Ok(conn.query_row(
        &format!("SELECT COALESCE(MAX(position), 0) + 1 FROM {table} WHERE project_id = ?1"),
        params![project_id],
        |row| row.get(0),
    )?)
}

pub fn create_type(conn: &Connection, project_id: Id, input: &ItemTypeInput) -> Result<Id> {
    projects::get(conn, project_id)?;
    let input = check_type(input)?;
    conn.execute(
        "INSERT INTO item_type (project_id, name, icon, kind, default_minutes, checklist, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            project_id,
            input.name,
            input.icon,
            input.kind,
            input.default_minutes,
            input.checklist,
            next_position(conn, "item_type", project_id)?
        ],
    )?;
    Ok(Id(conn.last_insert_rowid()))
}

pub fn update_type(conn: &Connection, id: Id, input: &ItemTypeInput) -> Result<()> {
    let current = get_type(conn, id)?;
    let input = check_type(input)?;
    if current.kind != "event" && input.kind == "event" {
        let untimed: i64 = conn.query_row(
            "SELECT COUNT(*) FROM task WHERE type_id = ?1 AND due_time IS NULL",
            params![id],
            |row| row.get(0),
        )?;
        if untimed > 0 {
            return Err(Error::invalid(
                "Some items of this type have no time yet. Events happen at a time.",
            ));
        }
    }
    conn.execute(
        "UPDATE item_type SET name = ?1, icon = ?2, kind = ?3, default_minutes = ?4, checklist = ?5
         WHERE id = ?6",
        params![
            input.name,
            input.icon,
            input.kind,
            input.default_minutes,
            input.checklist,
            id
        ],
    )?;
    Ok(())
}

pub fn delete_type(conn: &mut Connection, id: Id, replacement: Option<Id>) -> Result<()> {
    let current = get_type(conn, id)?;
    if let Some(other) = replacement {
        let target = get_type(conn, other)?;
        if target.project_id != current.project_id || other == id {
            return Err(Error::invalid("Pick another type from the same project."));
        }
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE task SET type_id = ?1 WHERE type_id = ?2",
        params![replacement, id],
    )?;
    tx.execute("DELETE FROM item_type WHERE id = ?1", params![id])?;
    tx.commit()?;
    Ok(())
}

fn check_status(input: &StatusInput) -> Result<StatusInput> {
    one_of(&input.category, &CATEGORIES, "category")?;
    Ok(StatusInput {
        name: required_text(&input.name, "Status name", 40)?,
        category: input.category.clone(),
    })
}

pub fn create_status(conn: &mut Connection, project_id: Id, input: &StatusInput) -> Result<Id> {
    projects::get(conn, project_id)?;
    let input = check_status(input)?;
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO item_status (project_id, name, category, position) VALUES (?1, ?2, ?3, ?4)",
        params![
            project_id,
            input.name,
            input.category,
            next_position(&tx, "item_status", project_id)?
        ],
    )?;
    let id = Id(tx.last_insert_rowid());
    reconcile(&tx)?;
    tx.commit()?;
    Ok(id)
}

pub fn update_status(conn: &mut Connection, id: Id, input: &StatusInput) -> Result<()> {
    get_status(conn, id)?;
    let input = check_status(input)?;
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE item_status SET name = ?1, category = ?2 WHERE id = ?3",
        params![input.name, input.category, id],
    )?;
    sync_completion(&tx, "status_id = ?1", params![id])?;
    tx.commit()?;
    Ok(())
}

pub fn reorder_status(conn: &mut Connection, id: Id, before: Option<Id>) -> Result<()> {
    let current = get_status(conn, id)?;
    let mut ids: Vec<Id> = conn
        .prepare(
            "SELECT id FROM item_status WHERE project_id = ?1 AND id != ?2 ORDER BY position, id",
        )?
        .query_map(params![current.project_id, id], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    let at = before
        .and_then(|b| ids.iter().position(|x| *x == b))
        .unwrap_or(ids.len());
    ids.insert(at, id);
    let tx = conn.transaction()?;
    for (position, status) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE item_status SET position = ?1 WHERE id = ?2",
            params![position as i64, status],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn delete_status(conn: &mut Connection, id: Id, replacement: Option<Id>) -> Result<()> {
    let current = get_status(conn, id)?;
    let used: i64 = conn.query_row(
        "SELECT COUNT(*) FROM task WHERE status_id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    if let Some(other) = replacement {
        let target = get_status(conn, other)?;
        if target.project_id != current.project_id || other == id {
            return Err(Error::invalid("Pick another status from the same project."));
        }
    } else if used > 0 {
        let others: i64 = conn.query_row(
            "SELECT COUNT(*) FROM item_status WHERE project_id = ?1 AND id != ?2",
            params![current.project_id, id],
            |row| row.get(0),
        )?;
        if others > 0 {
            return Err(Error::invalid("Choose where its items go first."));
        }
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE task SET status_id = ?1, status_changed_at = ?2 WHERE status_id = ?3",
        params![replacement, Timestamp::now(), id],
    )?;
    tx.execute("DELETE FROM item_status WHERE id = ?1", params![id])?;
    sync_completion(&tx, "project_id = ?1", params![current.project_id])?;
    tx.commit()?;
    Ok(())
}

fn check_milestone(input: &MilestoneInput) -> Result<String> {
    required_text(&input.name, "Milestone name", 80)
}

pub fn create_milestone(conn: &Connection, project_id: Id, input: &MilestoneInput) -> Result<Id> {
    projects::get(conn, project_id)?;
    let name = check_milestone(input)?;
    conn.execute(
        "INSERT INTO milestone (project_id, name, date, position) VALUES (?1, ?2, ?3, ?4)",
        params![
            project_id,
            name,
            input.date,
            next_position(conn, "milestone", project_id)?
        ],
    )?;
    Ok(Id(conn.last_insert_rowid()))
}

pub fn update_milestone(conn: &Connection, id: Id, input: &MilestoneInput) -> Result<()> {
    let name = check_milestone(input)?;
    let rows = conn.execute(
        "UPDATE milestone SET name = ?1, date = ?2 WHERE id = ?3",
        params![name, input.date, id],
    )?;
    ensure_changed(rows, "Milestone")
}

pub fn delete_milestone(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM milestone WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Milestone")
}

pub fn set_milestone_label(conn: &Connection, project_id: Id, label: &str) -> Result<()> {
    let label = optional_text(label, "Milestone name", 40)?;
    let rows = conn.execute(
        "UPDATE project SET milestone_label = ?1 WHERE id = ?2",
        params![label, project_id],
    )?;
    ensure_changed(rows, "Project")
}

pub fn create_view(conn: &Connection, project_id: Id, input: &ViewInput) -> Result<Id> {
    projects::get(conn, project_id)?;
    let input = check_view(input)?;
    conn.execute(
        "INSERT INTO saved_view (project_id, name, layout, group_by, filter, sort, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            project_id,
            input.name,
            input.layout,
            input.group_by,
            input.filter,
            input.sort,
            next_position(conn, "saved_view", project_id)?
        ],
    )?;
    Ok(Id(conn.last_insert_rowid()))
}

pub fn update_view(conn: &Connection, id: Id, input: &ViewInput) -> Result<()> {
    let input = check_view(input)?;
    let rows = conn.execute(
        "UPDATE saved_view SET name = ?1, layout = ?2, group_by = ?3, filter = ?4, sort = ?5
         WHERE id = ?6",
        params![
            input.name,
            input.layout,
            input.group_by,
            input.filter,
            input.sort,
            id
        ],
    )?;
    ensure_changed(rows, "View")
}

pub fn delete_view(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM saved_view WHERE id = ?1", params![id])?;
    ensure_changed(rows, "View")
}

pub fn apply_preset(conn: &mut Connection, project_id: Id, preset: &Preset) -> Result<()> {
    projects::get(conn, project_id)?;
    let types = preset
        .types
        .iter()
        .map(check_type)
        .collect::<Result<Vec<_>>>()?;
    let statuses = preset
        .statuses
        .iter()
        .map(check_status)
        .collect::<Result<Vec<_>>>()?;
    let views = preset
        .views
        .iter()
        .map(check_view)
        .collect::<Result<Vec<_>>>()?;
    let label = optional_text(&preset.milestone_label, "Milestone name", 40)?;
    let tx = conn.transaction()?;
    for (position, input) in types.iter().enumerate() {
        tx.execute(
            "INSERT INTO item_type (project_id, name, icon, kind, default_minutes, checklist, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project_id,
                input.name,
                input.icon,
                input.kind,
                input.default_minutes,
                input.checklist,
                position as i64
            ],
        )?;
    }
    for (position, input) in statuses.iter().enumerate() {
        tx.execute(
            "INSERT INTO item_status (project_id, name, category, position) VALUES (?1, ?2, ?3, ?4)",
            params![project_id, input.name, input.category, position as i64],
        )?;
    }
    for (position, input) in views.iter().enumerate() {
        tx.execute(
            "INSERT INTO saved_view (project_id, name, layout, group_by, filter, sort, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project_id,
                input.name,
                input.layout,
                input.group_by,
                input.filter,
                input.sort,
                position as i64
            ],
        )?;
    }
    tx.execute(
        "UPDATE project SET preset = ?1, milestone_label = ?2 WHERE id = ?3",
        params![optional_text(&preset.key, "Preset", 40)?, label, project_id],
    )?;
    reconcile(&tx)?;
    tx.commit()?;
    Ok(())
}

pub fn export_preset(conn: &Connection, project_id: Id) -> Result<Preset> {
    let project = projects::get(conn, project_id)?;
    let workflow = list(conn)?;
    Ok(Preset {
        key: format!("custom-{}", project.name.to_lowercase().replace(' ', "-")),
        name: project.name,
        description: String::new(),
        types: workflow
            .types
            .into_iter()
            .filter(|t| t.project_id == project_id)
            .map(|t| ItemTypeInput {
                name: t.name,
                icon: t.icon,
                kind: t.kind,
                default_minutes: t.default_minutes,
                checklist: t.checklist,
            })
            .collect(),
        statuses: workflow
            .statuses
            .into_iter()
            .filter(|s| s.project_id == project_id)
            .map(|s| StatusInput {
                name: s.name,
                category: s.category,
            })
            .collect(),
        milestone_label: project.milestone_label,
        views: workflow
            .views
            .into_iter()
            .filter(|v| v.project_id == project_id)
            .map(|v| ViewInput {
                name: v.name,
                layout: v.layout,
                group_by: v.group_by,
                filter: v.filter,
                sort: v.sort,
            })
            .collect(),
    })
}

pub fn parse_preset(text: &str) -> Result<Preset> {
    let preset: Preset = serde_json::from_str(text)
        .map_err(|_| Error::invalid("That file isn't a skkil time preset."))?;
    required_text(&preset.name, "Preset name", 60)?;
    for input in &preset.types {
        check_type(input)?;
    }
    for input in &preset.statuses {
        check_status(input)?;
    }
    for input in &preset.views {
        check_view(input)?;
    }
    Ok(preset)
}

pub(crate) fn reconcile(conn: &Connection) -> Result<()> {
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

fn sync_completion(conn: &Connection, filter: &str, args: impl rusqlite::Params) -> Result<()> {
    conn.execute(
        &format!(
            "UPDATE task SET completed_at = CASE
               WHEN (SELECT category FROM item_status WHERE id = task.status_id) IN ('done', 'dropped')
                 THEN COALESCE(completed_at, {now})
               ELSE NULL END
             WHERE status_id IS NOT NULL AND {filter}",
            now = Timestamp::now().0
        ),
        args,
    )?;
    Ok(())
}

pub(crate) fn status_for_completion(conn: &Connection, task_id: Id, completed: bool) -> Result<()> {
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
        params![task_id, Timestamp::now(), completed],
    )?;
    Ok(())
}

pub fn set_task_type(conn: &mut Connection, id: Id, type_id: Option<Id>) -> Result<tasks::Task> {
    let task = tasks::get(conn, id)?;
    let item_type = match type_id {
        Some(type_id) => {
            let item_type = get_type(conn, type_id)?;
            if Some(item_type.project_id) != task.project_id {
                return Err(Error::invalid("That type belongs to another project."));
            }
            if item_type.kind == "event" && task.due_time.is_none() {
                return Err(Error::invalid(
                    "Give it a date and time first. Events happen at a time.",
                ));
            }
            Some(item_type)
        }
        None => None,
    };
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE task SET type_id = ?1,
                         estimate_minutes = COALESCE(estimate_minutes, ?2),
                         completed_at = CASE WHEN ?3 THEN NULL ELSE completed_at END
         WHERE id = ?4",
        params![
            type_id,
            item_type.as_ref().and_then(|t| t.default_minutes),
            item_type.as_ref().is_some_and(|t| t.kind == "event"),
            id
        ],
    )?;
    let has_children: bool = tx.query_row(
        "SELECT EXISTS (SELECT 1 FROM task WHERE parent_id = ?1)",
        params![id],
        |row| row.get(0),
    )?;
    if let Some(item_type) = &item_type
        && !has_children
    {
        for (position, line) in item_type
            .checklist
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .enumerate()
        {
            tx.execute(
                "INSERT INTO task (title, project_id, section_id, parent_id, position, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    line,
                    task.project_id,
                    task.section_id,
                    id,
                    position as i64,
                    Timestamp::now()
                ],
            )?;
        }
        reconcile(&tx)?;
    }
    tx.commit()?;
    tasks::get(conn, id)
}

pub fn set_task_status(conn: &mut Connection, id: Id, status_id: Id) -> Result<tasks::Task> {
    let task = tasks::get(conn, id)?;
    let status = get_status(conn, status_id)?;
    if Some(status.project_id) != task.project_id {
        return Err(Error::invalid("That status belongs to another project."));
    }
    if task.kind == "event" {
        return Err(Error::invalid(
            "Events happen at a time; they don't have a status.",
        ));
    }
    let closing = matches!(status.category.as_str(), "done" | "dropped");
    if closing && task.completed_at.is_none() && task.recurrence.is_some() {
        return tasks::set_completed(conn, id, true);
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE task SET status_id = ?1, status_changed_at = ?2 WHERE id = ?3",
        params![status_id, Timestamp::now(), id],
    )?;
    if closing && task.completed_at.is_none() {
        let now = Timestamp::now();
        tx.execute(
            "UPDATE task SET completed_at = ?1
             WHERE completed_at IS NULL AND id IN (
               WITH RECURSIVE down(id) AS (
                 SELECT ?2 UNION ALL SELECT t.id FROM task t JOIN down ON t.parent_id = down.id)
               SELECT id FROM down)",
            params![now, id],
        )?;
    } else if !closing {
        tx.execute(
            "UPDATE task SET completed_at = NULL WHERE id = ?1",
            params![id],
        )?;
    }
    tx.commit()?;
    tasks::get(conn, id)
}

pub fn set_task_milestone(
    conn: &Connection,
    id: Id,
    milestone_id: Option<Id>,
) -> Result<tasks::Task> {
    let task = tasks::get(conn, id)?;
    if let Some(milestone_id) = milestone_id {
        let project: Id = conn
            .query_row(
                "SELECT project_id FROM milestone WHERE id = ?1",
                params![milestone_id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or_else(|| Error::not_found("Milestone"))?;
        if Some(project) != task.project_id {
            return Err(Error::invalid("That milestone belongs to another project."));
        }
    }
    conn.execute(
        "UPDATE task SET milestone_id = ?1 WHERE id = ?2",
        params![milestone_id, id],
    )?;
    tasks::get(conn, id)
}

pub fn set_task_event(
    conn: &Connection,
    id: Id,
    location: &str,
    counts_as_time: bool,
) -> Result<tasks::Task> {
    let location = optional_text(location, "Location", 300)?;
    let rows = conn.execute(
        "UPDATE task SET location = ?1, counts_as_time = ?2 WHERE id = ?3",
        params![location, counts_as_time, id],
    )?;
    ensure_changed(rows, "Task")?;
    tasks::get(conn, id)
}

pub fn occurrences(conn: &Connection, from: Date, to: Date) -> Result<Vec<EventOccurrence>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.title, t.project_id, t.type_id, t.due_date, t.due_time,
                COALESCE(t.estimate_minutes, ty.default_minutes, ?2), t.recurrence,
                t.location, t.counts_as_time
           FROM task t
           JOIN item_type ty ON ty.id = t.type_id AND ty.kind = 'event'
           LEFT JOIN project p ON p.id = t.project_id
          WHERE t.due_date IS NOT NULL AND t.due_time IS NOT NULL AND t.due_date < ?1
            AND t.completed_at IS NULL AND (p.id IS NULL OR p.archived = 0)",
    )?;
    let rows = stmt.query_map(params![to, DEFAULT_EVENT_MINUTES], |row| {
        Ok((
            row.get::<_, Id>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<Id>>(2)?,
            row.get::<_, Option<Id>>(3)?,
            row.get::<_, Date>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, bool>(9)?,
        ))
    })?;
    let mut result = Vec::new();
    for row in rows {
        let (
            task_id,
            title,
            project_id,
            type_id,
            due,
            minute,
            length,
            recurrence,
            location,
            counts,
        ) = row?;
        let rule = recurrence.as_deref().and_then(Rule::parse);
        let mut day = due;
        while day < to {
            if day >= from {
                let start_at = Timestamp(day.start().0 + minute * 60);
                result.push(EventOccurrence {
                    task_id,
                    title: title.clone(),
                    project_id,
                    type_id,
                    start_at,
                    end_at: Timestamp(start_at.0 + length * 60),
                    location: location.clone(),
                    counts_as_time: counts,
                });
            }
            match &rule {
                Some(rule) => day = Date(rule.step(day.0)),
                None => break,
            }
        }
    }
    result.sort_by_key(|event| event.start_at.0);
    Ok(result)
}

pub fn counted_event_seconds(conn: &Connection, from: Date, to: Date) -> Result<i64> {
    let now = Timestamp::now();
    Ok(occurrences(conn, from, to)?
        .iter()
        .filter(|event| event.counts_as_time && event.end_at <= now)
        .map(|event| event.end_at.0 - event.start_at.0)
        .sum())
}

pub fn time_by_type(conn: &Connection, from: Date, to: Date) -> Result<Vec<TypeTime>> {
    let mut totals: Vec<TypeTime> = Vec::new();
    let mut add =
        |name: String, icon: String, seconds: i64| match totals.iter_mut().find(|t| t.name == name)
        {
            Some(total) => total.seconds = Seconds(total.seconds.0 + seconds),
            None => totals.push(TypeTime {
                name,
                icon,
                seconds: Seconds(seconds),
            }),
        };
    let mut stmt = conn.prepare(
        "SELECT ty.name, ty.icon, SUM(e.ended_at - e.started_at)
           FROM time_entry e
           JOIN task t ON t.id = e.task_id
           JOIN item_type ty ON ty.id = t.type_id
          WHERE e.started_at >= ?1 AND e.started_at < ?2
          GROUP BY ty.name, ty.icon",
    )?;
    let rows = stmt.query_map(params![from.start(), to.start()], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;
    for row in rows {
        let (name, icon, seconds) = row?;
        add(name, icon, seconds);
    }
    let now = Timestamp::now();
    for event in occurrences(conn, from, to)? {
        if !event.counts_as_time || event.end_at > now {
            continue;
        }
        if let Some(type_id) = event.type_id {
            let item_type = get_type(conn, type_id)?;
            add(
                item_type.name,
                item_type.icon,
                event.end_at.0 - event.start_at.0,
            );
        }
    }
    totals.sort_by_key(|total| std::cmp::Reverse(total.seconds.0));
    Ok(totals)
}

#[tauri::command]
#[specta::specta]
pub async fn get_workflow(db: State<'_, Db>) -> Result<Workflow> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn list_presets() -> Result<Vec<Preset>> {
    Ok(presets())
}

#[tauri::command]
#[specta::specta]
pub async fn create_item_type(
    db: State<'_, Db>,
    project_id: Id,
    input: ItemTypeInput,
) -> Result<Id> {
    db.call(|conn| create_type(conn, project_id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_item_type(db: State<'_, Db>, id: Id, input: ItemTypeInput) -> Result<()> {
    db.call(|conn| update_type(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_item_type(db: State<'_, Db>, id: Id, replacement: Option<Id>) -> Result<()> {
    db.call(|conn| delete_type(conn, id, replacement))
}

#[tauri::command]
#[specta::specta]
pub async fn create_item_status(
    db: State<'_, Db>,
    project_id: Id,
    input: StatusInput,
) -> Result<Id> {
    db.call(|conn| create_status(conn, project_id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_item_status(db: State<'_, Db>, id: Id, input: StatusInput) -> Result<()> {
    db.call(|conn| update_status(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn reorder_item_status(db: State<'_, Db>, id: Id, before: Option<Id>) -> Result<()> {
    db.call(|conn| reorder_status(conn, id, before))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_item_status(db: State<'_, Db>, id: Id, replacement: Option<Id>) -> Result<()> {
    db.call(|conn| delete_status(conn, id, replacement))
}

#[tauri::command]
#[specta::specta]
pub async fn create_project_milestone(
    db: State<'_, Db>,
    project_id: Id,
    input: MilestoneInput,
) -> Result<Id> {
    db.call(|conn| create_milestone(conn, project_id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_project_milestone(
    db: State<'_, Db>,
    id: Id,
    input: MilestoneInput,
) -> Result<()> {
    db.call(|conn| update_milestone(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_project_milestone(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete_milestone(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_milestone_label(db: State<'_, Db>, id: Id, label: String) -> Result<()> {
    db.call(|conn| set_milestone_label(conn, id, &label))
}

#[tauri::command]
#[specta::specta]
pub async fn create_saved_view(db: State<'_, Db>, project_id: Id, input: ViewInput) -> Result<Id> {
    db.call(|conn| create_view(conn, project_id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_saved_view(db: State<'_, Db>, id: Id, input: ViewInput) -> Result<()> {
    db.call(|conn| update_view(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn delete_saved_view(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete_view(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn apply_project_preset(db: State<'_, Db>, id: Id, preset: Preset) -> Result<()> {
    db.call(|conn| apply_preset(conn, id, &preset))
}

#[tauri::command]
#[specta::specta]
pub async fn save_project_preset(
    app: tauri::AppHandle,
    db: State<'_, Db>,
    id: Id,
) -> Result<String> {
    let preset = db.call(|conn| export_preset(conn, id))?;
    let folder = app
        .path()
        .download_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|_| Error::invalid("Couldn't find a folder to save the preset in."))?;
    let path = folder.join(format!("{}.skkil-preset.json", preset.key));
    let text = serde_json::to_string_pretty(&preset)
        .map_err(|_| Error::invalid("Couldn't write the preset."))?;
    std::fs::write(&path, text).map_err(|e| Error::invalid(format!("Couldn't save: {e}")))?;
    Ok(path.display().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn read_preset(text: String) -> Result<Preset> {
    parse_preset(&text)
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_type_id(
    db: State<'_, Db>,
    id: Id,
    type_id: Option<Id>,
) -> Result<tasks::Task> {
    db.call(|conn| set_task_type(conn, id, type_id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_status_id(db: State<'_, Db>, id: Id, status_id: Id) -> Result<tasks::Task> {
    db.call(|conn| set_task_status(conn, id, status_id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_milestone_id(
    db: State<'_, Db>,
    id: Id,
    milestone_id: Option<Id>,
) -> Result<tasks::Task> {
    db.call(|conn| set_task_milestone(conn, id, milestone_id))
}

#[tauri::command]
#[specta::specta]
pub async fn set_task_event_details(
    db: State<'_, Db>,
    id: Id,
    location: String,
    counts_as_time: bool,
) -> Result<tasks::Task> {
    db.call(|conn| set_task_event(conn, id, &location, counts_as_time))
}

#[tauri::command]
#[specta::specta]
pub async fn list_events(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<EventOccurrence>> {
    db.call(|conn| occurrences(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn list_time_by_type(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<TypeTime>> {
    db.call(|conn| time_by_type(conn, from, to))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::tasks::input;
    use crate::types::date;

    fn project(conn: &Connection, name: &str) -> Result<Id> {
        Ok(projects::create(
            conn,
            &projects::ProjectInput {
                name: name.into(),
                parent_id: None,
                color: "blue".into(),
            },
        )?
        .id)
    }

    fn preset(key: &str) -> Preset {
        presets().into_iter().find(|p| p.key == key).unwrap()
    }

    #[test]
    fn simple_projects_get_no_structure() {
        let db = Db::in_memory();
        db.call(|conn| {
            let id = project(conn, "Plain")?;
            apply_preset(conn, id, &preset("simple"))?;
            let task = tasks::create(conn, &input("Write", Some(id)))?;
            assert_eq!(task.status_id, None);
            assert_eq!(task.kind, "task");
            let workflow = list(conn)?;
            assert!(workflow.types.is_empty() && workflow.statuses.is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn presets_give_new_and_existing_tasks_a_status() {
        let db = Db::in_memory();
        db.call(|conn| {
            let id = project(conn, "App")?;
            let old = tasks::create(conn, &input("Old", Some(id)))?;
            let done = tasks::create(conn, &input("Shipped", Some(id)))?;
            tasks::set_completed(conn, done.id, true)?;
            apply_preset(conn, id, &preset("software"))?;

            assert_eq!(
                tasks::get(conn, old.id)?.status_category.as_deref(),
                Some("todo")
            );
            assert_eq!(
                tasks::get(conn, done.id)?.status_category.as_deref(),
                Some("done")
            );
            let new = tasks::create(conn, &input("New", Some(id)))?;
            assert_eq!(new.status_category.as_deref(), Some("todo"));
            assert_eq!(list(conn)?.views.len(), 4);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn statuses_and_completion_stay_in_step() {
        let db = Db::in_memory();
        db.call(|conn| {
            let id = project(conn, "App")?;
            apply_preset(conn, id, &preset("software"))?;
            let statuses = list(conn)?.statuses;
            let by = |name: &str| statuses.iter().find(|s| s.name == name).unwrap().id;
            let task = tasks::create(conn, &input("Login", Some(id)))?;

            let task = set_task_status(conn, task.id, by("In review"))?;
            assert!(task.completed_at.is_none());
            assert!(task.status_changed_at.is_some());
            let task = set_task_status(conn, task.id, by("Canceled"))?;
            assert!(task.completed_at.is_some());

            let task = tasks::set_completed(conn, task.id, false)?;
            assert_eq!(task.status_category.as_deref(), Some("todo"));
            let task = tasks::set_completed(conn, task.id, true)?;
            assert_eq!(task.status_id, Some(by("Done")));

            assert!(delete_status(conn, by("Done"), None).is_err());
            delete_status(conn, by("Done"), Some(by("Canceled")))?;
            assert_eq!(tasks::get(conn, task.id)?.status_id, Some(by("Canceled")));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn moving_to_another_project_maps_type_and_status() {
        let db = Db::in_memory();
        db.call(|conn| {
            let a = project(conn, "A")?;
            let b = project(conn, "B")?;
            apply_preset(conn, a, &preset("software"))?;
            apply_preset(conn, b, &preset("software"))?;
            let workflow = list(conn)?;
            let bug = |p: Id| {
                workflow
                    .types
                    .iter()
                    .find(|t| t.project_id == p && t.name == "Bug")
                    .unwrap()
                    .id
            };
            let task = tasks::create(conn, &input("Crash", Some(a)))?;
            set_task_type(conn, task.id, Some(bug(a)))?;
            let moved = tasks::move_to(
                conn,
                task.id,
                tasks::TaskPlacement {
                    project_id: Some(b),
                    section_id: None,
                    parent_id: None,
                    before: None,
                },
            )?;
            assert_eq!(moved.type_id, Some(bug(b)));
            assert_eq!(moved.status_category.as_deref(), Some("todo"));

            let inbox = tasks::move_to(
                conn,
                task.id,
                tasks::TaskPlacement {
                    project_id: None,
                    section_id: None,
                    parent_id: None,
                    before: None,
                },
            )?;
            assert_eq!((inbox.type_id, inbox.status_id), (None, None));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn types_add_their_checklist_and_events_need_a_time() {
        let db = Db::in_memory();
        db.call(|conn| {
            let id = project(conn, "Course")?;
            let mut course = preset("course");
            course.types[1].checklist = "Skim\nTake notes\n".into();
            apply_preset(conn, id, &course)?;
            let types = list(conn)?.types;
            let reading = types.iter().find(|t| t.name == "Reading").unwrap().id;
            let lecture = types.iter().find(|t| t.name == "Lecture").unwrap().id;

            let task = tasks::create(conn, &input("Chapter 3", Some(id)))?;
            set_task_type(conn, task.id, Some(reading))?;
            let children: i64 = conn.query_row(
                "SELECT COUNT(*) FROM task WHERE parent_id = ?1",
                params![task.id],
                |row| row.get(0),
            )?;
            assert_eq!(children, 2);

            let talk = tasks::create(conn, &input("Lecture 1", Some(id)))?;
            assert!(set_task_type(conn, talk.id, Some(lecture)).is_err());
            let mut timed = input("Lecture 1", Some(id));
            timed.due_date = Some(date("2026-11-02"));
            timed.due_time = Some(10 * 60);
            timed.recurrence = Some("every monday".into());
            let talk = tasks::update(conn, talk.id, &timed)?;
            let talk = set_task_type(conn, talk.id, Some(lecture))?;
            assert_eq!(talk.kind, "event");
            assert_eq!(talk.estimate_minutes, Some(90));
            assert!(tasks::set_completed(conn, talk.id, true).is_err());

            let events = occurrences(conn, date("2026-11-02"), date("2026-11-23"))?;
            assert_eq!(events.len(), 3);
            assert_eq!(
                events[1].start_at.0,
                date("2026-11-09").start().0 + 10 * 3600
            );
            assert_eq!(events[0].end_at.0 - events[0].start_at.0, 90 * 60);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn presets_round_trip_through_a_file() {
        let db = Db::in_memory();
        db.call(|conn| {
            let id = project(conn, "Job hunt")?;
            apply_preset(conn, id, &preset("pipeline"))?;
            let exported = export_preset(conn, id)?;
            let text = serde_json::to_string(&exported).unwrap();
            let parsed = parse_preset(&text)?;
            assert_eq!(parsed.statuses.len(), 5);
            assert!(parse_preset("{}").is_err());
            Ok(())
        })
        .unwrap();
    }
}
