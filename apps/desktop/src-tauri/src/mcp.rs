use std::path::PathBuf;

use chrono::{Local, NaiveDate, TimeZone};
use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{Implementation, ServerCapabilities, ServerConfig};
use rmcp::{ServerHandler, ServiceExt, tool, tool_handler, tool_router};
use rusqlite::Connection;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use time_core::sync::Engine;
use time_core::time_entries::{self, EntryDetails, RunningTimer};
use time_core::types::{Date, Id, Timestamp};
use time_core::{Error as AppError, Result as AppResult, mutations};
use time_core::{blocks, groups, projects, sections, tasks};

use crate::db::{self, DATABASE_FILE, Db};

pub const FLAG: &str = "--mcp";
const DB_ENV: &str = "SKKIL_TIME_DB";
const IDENTIFIER: &str = "com.skkil.time";
const DEFAULT_LIMIT: usize = 50;

const INSTRUCTIONS: &str = "skkil time is the user's local planner. Tasks belong to a project or \
the Inbox. Priority 1 is the highest and 4 is normal. Dates are YYYY-MM-DD (or today/tomorrow), \
times are HH:MM in the user's local time. Repeats use Todoist wording such as \"every day\" or \
\"every monday\". Start with `today` to see what the user is working on. Never add a sub-task \
to a finished task unless the user says so: the app hides it until the parent is reopened.";

fn database_path() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os(DB_ENV) {
        return Ok(PathBuf::from(path));
    }
    dirs::data_dir()
        .map(|dir| dir.join(IDENTIFIER).join(DATABASE_FILE))
        .ok_or_else(|| format!("No data directory found; set {DB_ENV}."))
}

pub fn serve() -> Result<(), String> {
    let path = database_path()?;
    if !path.exists() {
        return Err(format!(
            "{} doesn't exist yet. Open skkil time once first.",
            path.display()
        ));
    }
    let db = db::open(&path).map_err(|error| error.to_string())?;
    tokio::runtime::Runtime::new()
        .map_err(|error| error.to_string())?
        .block_on(async {
            let service = Planner::new(db)
                .serve(rmcp::transport::stdio())
                .await
                .map_err(|error| error.to_string())?;
            service.waiting().await.map_err(|error| error.to_string())?;
            Ok(())
        })
}

#[derive(Debug, Serialize)]
struct TaskView {
    id: Id,
    title: String,
    project: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    section: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<Id>,
    priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    due: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    deadline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    repeats: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    estimate_minutes: Option<i32>,
    #[serde(skip_serializing_if = "String::is_empty")]
    notes: String,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    done: bool,
}

#[derive(Debug, Serialize)]
struct ProjectView {
    id: Option<Id>,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<Id>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    target_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    weekly_hours: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop_if: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    archived: bool,
    sections: Vec<SectionView>,
}

#[derive(Debug, Serialize)]
struct SectionView {
    id: Id,
    name: String,
}

#[derive(Debug, Serialize)]
struct FocusView {
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_id: Option<Id>,
    started: String,
    focused_minutes: i64,
    on_break: bool,
}

#[derive(Debug, Serialize)]
struct SpanView {
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    task_id: Option<Id>,
    start: String,
    end: String,
}

#[derive(Debug, Serialize)]
struct TodayView {
    date: String,
    overdue: Vec<TaskView>,
    due_today: Vec<TaskView>,
    planned_blocks: Vec<SpanView>,
    focused_minutes: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    focusing: Option<FocusView>,
}

fn clock(minutes: i32) -> String {
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

fn local_time(at: Timestamp) -> String {
    Local
        .timestamp_opt(at.0, 0)
        .single()
        .map(|time| time.format("%Y-%m-%d %H:%M").to_string())
        .unwrap_or_default()
}

fn parse_date(text: &str) -> AppResult<Date> {
    let today = Date::today();
    match text.trim().to_lowercase().as_str() {
        "today" => Ok(today),
        "tomorrow" => Ok(today.add_days(1)),
        "yesterday" => Ok(today.add_days(-1)),
        other => NaiveDate::parse_from_str(other, "%Y-%m-%d")
            .map(Date)
            .map_err(|_| AppError::invalid(format!("Use YYYY-MM-DD for dates, not “{text}”."))),
    }
}

fn parse_clock(text: &str) -> AppResult<i32> {
    let invalid = || AppError::invalid(format!("Use HH:MM for times, not “{text}”."));
    let (hours, minutes) = text.trim().split_once(':').ok_or_else(invalid)?;
    let hours: i32 = hours.parse().map_err(|_| invalid())?;
    let minutes: i32 = minutes.parse().map_err(|_| invalid())?;
    if !(0..24).contains(&hours) || !(0..60).contains(&minutes) {
        return Err(invalid());
    }
    Ok(hours * 60 + minutes)
}

fn optional_date(text: Option<&str>) -> AppResult<Option<Date>> {
    match text.map(str::trim) {
        None | Some("") => Ok(None),
        Some(text) => parse_date(text).map(Some),
    }
}

struct Names {
    projects: Vec<projects::Project>,
    sections: Vec<sections::Section>,
    groups: Vec<groups::Group>,
}

impl Names {
    fn load(conn: &Connection) -> AppResult<Self> {
        Ok(Self {
            projects: projects::list(conn)?,
            sections: sections::list(conn)?,
            groups: groups::list(conn)?,
        })
    }

    fn project_view(&self, project: &projects::Project) -> ProjectView {
        ProjectView {
            id: Some(project.id.clone()),
            name: project.name.clone(),
            parent_id: project.parent_id.clone(),
            status: Some(project.status.clone()),
            color: Some(project.color.clone()),
            group: project
                .group_id
                .as_ref()
                .and_then(|id| self.groups.iter().find(|group| &group.id == id))
                .map(|group| group.name.clone()),
            target_date: project.target_date.map(|date| date.0.to_string()),
            weekly_hours: project
                .weekly_minutes
                .map(|minutes| f64::from(minutes) / 60.0),
            stop_if: Some(project.kill_criteria.clone()).filter(|text| !text.is_empty()),
            archived: project.archived,
            sections: self.sections_of(Some(&project.id)),
        }
    }

    fn project(&self, id: Option<&Id>) -> String {
        id.and_then(|id| self.projects.iter().find(|project| &project.id == id))
            .map_or_else(|| "Inbox".to_owned(), |project| project.name.clone())
    }

    fn section(&self, id: Option<&Id>) -> Option<String> {
        id.and_then(|id| self.sections.iter().find(|section| &section.id == id))
            .map(|section| section.name.clone())
    }

    fn sections_of(&self, project_id: Option<&Id>) -> Vec<SectionView> {
        self.sections
            .iter()
            .filter(|section| section.project_id.as_ref() == project_id)
            .map(|section| SectionView {
                id: section.id.clone(),
                name: section.name.clone(),
            })
            .collect()
    }
}

fn matches(text: &str, id: &Id, name: &str) -> bool {
    id.as_str().eq_ignore_ascii_case(text) || name.eq_ignore_ascii_case(text)
}

fn resolve_section(conn: &Connection, project_id: Option<&Id>, text: &str) -> AppResult<Id> {
    let text = text.trim();
    let names = Names::load(conn)?;
    names
        .sections
        .iter()
        .filter(|section| section.project_id.as_ref() == project_id)
        .find(|section| matches(text, &section.id, &section.name))
        .map(|section| section.id.clone())
        .ok_or_else(|| {
            let available: Vec<String> = names
                .sections_of(project_id)
                .into_iter()
                .map(|section| section.name)
                .collect();
            let project = names.project(project_id);
            AppError::invalid(if available.is_empty() {
                format!("{project} has no sections.")
            } else {
                format!(
                    "{project} has no section called “{text}”. Sections: {}.",
                    available.join(", ")
                )
            })
        })
}

fn resolve_project(conn: &Connection, text: &str) -> AppResult<Option<Id>> {
    let text = text.trim();
    if text.eq_ignore_ascii_case("inbox") {
        return Ok(None);
    }
    let all = projects::list(conn)?;
    let open = all.iter().filter(|project| !project.archived);
    let found = open
        .clone()
        .find(|project| matches(text, &project.id, &project.name));
    found
        .map(|project| Some(project.id.clone()))
        .ok_or_else(|| {
            let names: Vec<&str> = std::iter::once("Inbox")
                .chain(open.map(|project| project.name.as_str()))
                .collect();
            AppError::invalid(format!(
                "No project called “{text}”. Projects: {}.",
                names.join(", ")
            ))
        })
}

fn named_project(conn: &Connection, text: &str) -> AppResult<projects::Project> {
    let text = text.trim();
    if text.eq_ignore_ascii_case("inbox") {
        return Err(AppError::invalid(
            "The Inbox isn't a project; pick a project.",
        ));
    }
    let all = projects::list(conn)?;
    let mut found = all
        .iter()
        .filter(|project| matches(text, &project.id, &project.name));
    let pick = found
        .clone()
        .find(|project| !project.archived)
        .or_else(|| found.next());
    let id = pick
        .map(|project| project.id.clone())
        .ok_or_else(|| AppError::invalid(format!("No project called “{text}”.")))?;
    projects::get(conn, &id)
}

fn resolve_group(conn: &mut Writer, text: &str) -> AppResult<Option<Id>> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(None);
    }
    let existing = groups::list(conn)?
        .into_iter()
        .find(|group| matches(text, &group.id, &group.name));
    match existing {
        Some(group) => Ok(Some(group.id)),
        None => Ok(Some(
            mutate::<groups::Group>(conn, "createGroup", json!({ "name": text }))?.id,
        )),
    }
}

fn check_color(color: &str) -> AppResult<String> {
    let color = color.trim().to_lowercase();
    if projects::COLORS.contains(&color.as_str()) {
        Ok(color)
    } else {
        Err(AppError::invalid(format!(
            "Colours: {}.",
            projects::COLORS.join(", ")
        )))
    }
}

fn hours_to_minutes(hours: f64) -> Option<i32> {
    (hours > 0.0).then(|| (hours * 60.0).round() as i32)
}

fn settings_of(project: &projects::Project) -> projects::ProjectSettings {
    projects::ProjectSettings {
        group_id: project.group_id.clone(),
        status: project.status.clone(),
        outcome: project.outcome.clone(),
        weekly_minutes: project.weekly_minutes,
        target_date: project.target_date,
        kill_criteria: project.kill_criteria.clone(),
        review_every_weeks: project.review_every_weeks,
        in_order: project.in_order,
    }
}

fn view(task: &tasks::Task, names: &Names) -> TaskView {
    TaskView {
        id: task.id.clone(),
        title: task.title.clone(),
        project: names.project(task.project_id.as_ref()),
        section: names.section(task.section_id.as_ref()),
        parent_id: task.parent_id.clone(),
        priority: task.priority,
        due: task.due_date.map(|date| match task.due_time {
            Some(minutes) => format!("{} {}", date.0, clock(minutes)),
            None => date.0.to_string(),
        }),
        deadline: task.deadline.map(|date| date.0.to_string()),
        repeats: task.recurrence.clone(),
        estimate_minutes: task.estimate_minutes,
        notes: task.notes.clone(),
        done: task.completed_at.is_some(),
    }
}

fn focus_view(conn: &Connection, timer: &RunningTimer) -> AppResult<FocusView> {
    let title = match &timer.task_id {
        Some(id) => tasks::get(conn, id)?.title,
        None if !timer.description.is_empty() => timer.description.clone(),
        None => "Focus".to_owned(),
    };
    let current = match timer.paused_at {
        Some(_) => 0,
        None => timer.started_at.seconds_until(Timestamp::now()).max(0),
    };
    Ok(FocusView {
        title,
        task_id: timer.task_id.clone(),
        started: local_time(timer.started_at),
        focused_minutes: (timer.banked_seconds + current) / 60,
        on_break: timer.paused_at.is_some(),
    })
}

/// The engine a writing tool works through: it reads like a connection,
/// and [`mutate`] applies each change as a synced mutation.
struct Writer<'a>(&'a mut Engine);

impl std::ops::Deref for Writer<'_> {
    type Target = Connection;

    fn deref(&self) -> &Connection {
        self.0.connection()
    }
}

/// Applies one write through the sync engine, so the MCP server changes
/// data exactly as the app does and the change syncs.
fn mutate<T: DeserializeOwned>(writer: &mut Writer, name: &str, args: Value) -> AppResult<T> {
    mutations::result(writer.0.mutate(name, &args)?)
}

fn check_parent_open(parent: &tasks::Task, agreed: bool) -> AppResult<()> {
    if parent.completed_at.is_none() || agreed {
        return Ok(());
    }
    Err(AppError::invalid(format!(
        "“{}” is finished, so a sub-task under it stays hidden. Ask the user first, then retry with under_finished_parent: true, or add it elsewhere.",
        parent.title
    )))
}

fn parse_id(text: &str) -> AppResult<Id> {
    Id::parse(text.trim())
}

fn to_json<T: Serialize>(value: &T) -> AppResult<String> {
    serde_json::to_string_pretty(value).map_err(|error| AppError::invalid(error.to_string()))
}

#[derive(Debug, Default, Deserialize, JsonSchema)]
struct ListTasks {
    #[schemars(description = "Project name or id, or \"Inbox\". Leave out for every project.")]
    project: Option<String>,
    #[schemars(description = "Section name or id. Searched within project when one is given.")]
    section: Option<String>,
    #[schemars(
        description = "Only tasks due on or before this date (YYYY-MM-DD, today, tomorrow)."
    )]
    due_by: Option<String>,
    #[schemars(description = "Only tasks whose title or notes contain this text.")]
    search: Option<String>,
    #[schemars(description = "Include tasks finished in the last two weeks.")]
    include_done: Option<bool>,
    #[schemars(description = "Most tasks to return (default 50).")]
    limit: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddTask {
    title: String,
    notes: Option<String>,
    #[schemars(description = "Project name or id, or \"Inbox\" (the default).")]
    project: Option<String>,
    #[schemars(description = "Section name or id inside that project.")]
    section: Option<String>,
    #[schemars(
        description = "Make it a sub-task of this task id; it joins that task's project and section."
    )]
    parent_id: Option<String>,
    #[schemars(
        description = "Set only after the user has agreed to add a sub-task to a finished task; such sub-tasks stay hidden until the parent is reopened."
    )]
    under_finished_parent: Option<bool>,
    #[schemars(description = "1 (highest) to 4 (normal, the default).")]
    priority: Option<i32>,
    #[schemars(description = "YYYY-MM-DD, today or tomorrow.")]
    due_date: Option<String>,
    #[schemars(description = "HH:MM, local time. Needs a due date or a repeat.")]
    due_time: Option<String>,
    #[schemars(description = "Todoist wording, e.g. \"every day\" or \"every monday\".")]
    repeat: Option<String>,
    #[schemars(description = "Hard deadline, YYYY-MM-DD.")]
    deadline: Option<String>,
    estimate_minutes: Option<i32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct UpdateTask {
    id: String,
    #[schemars(
        description = "Move to this project (name, id or \"Inbox\"). A moved sub-task becomes a top-level task."
    )]
    project: Option<String>,
    #[schemars(
        description = "Move to this section (name or id) of the task's project, or of project when given; an empty string takes it out of its section."
    )]
    section: Option<String>,
    title: Option<String>,
    notes: Option<String>,
    #[schemars(description = "1 (highest) to 4 (normal).")]
    priority: Option<i32>,
    #[schemars(description = "YYYY-MM-DD, today or tomorrow; an empty string clears it.")]
    due_date: Option<String>,
    #[schemars(description = "HH:MM; an empty string clears it.")]
    due_time: Option<String>,
    #[schemars(description = "Todoist wording; an empty string stops the repeat.")]
    repeat: Option<String>,
    #[schemars(description = "YYYY-MM-DD; an empty string clears it.")]
    deadline: Option<String>,
    estimate_minutes: Option<i32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CompleteTask {
    id: String,
    #[schemars(
        description = "false reopens the task. A repeating task moves to its next date instead of closing."
    )]
    done: Option<bool>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct StartFocus {
    #[schemars(description = "The task being worked on, if any.")]
    task_id: Option<String>,
    #[schemars(description = "What the session is about when there is no task.")]
    description: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct FocusHistory {
    #[schemars(description = "First day, YYYY-MM-DD (default today).")]
    from: Option<String>,
    #[schemars(description = "Last day, YYYY-MM-DD (default the same as from).")]
    to: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ListProjects {
    #[schemars(description = "Also list archived projects.")]
    include_archived: Option<bool>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddProject {
    name: String,
    #[schemars(description = "Put it inside this project (name or id). Projects nest three deep.")]
    parent: Option<String>,
    #[schemars(
        description = "graphite, blue, teal, green, olive, amber, rust or plum (default blue)."
    )]
    color: Option<String>,
    #[schemars(
        description = "Group name for a top-level project; a new group is made if none has that name."
    )]
    group: Option<String>,
    #[schemars(description = "YYYY-MM-DD. Leave out for ongoing work.")]
    target_date: Option<String>,
    weekly_hours: Option<f64>,
    #[schemars(description = "When to drop the project, in a sentence.")]
    stop_if: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct UpdateProject {
    #[schemars(description = "The project to change, by name or id.")]
    project: String,
    name: Option<String>,
    color: Option<String>,
    #[schemars(
        description = "Move inside this project (name or id); an empty string makes it top-level."
    )]
    parent: Option<String>,
    #[schemars(
        description = "Group name (made if new); an empty string takes it out of its group."
    )]
    group: Option<String>,
    #[schemars(description = "active, paused, done or dropped.")]
    status: Option<String>,
    #[schemars(description = "YYYY-MM-DD; an empty string clears it.")]
    target_date: Option<String>,
    #[schemars(description = "Hours a week; 0 clears it.")]
    weekly_hours: Option<f64>,
    #[schemars(description = "An empty string clears it.")]
    stop_if: Option<String>,
    #[schemars(
        description = "true archives the project and its sub-projects; false brings them back."
    )]
    archived: Option<bool>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddSection {
    #[schemars(description = "Project name or id, or \"Inbox\".")]
    project: String,
    name: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct RenameSection {
    #[schemars(description = "Project name or id, or \"Inbox\".")]
    project: String,
    #[schemars(description = "Current section name or id.")]
    section: String,
    name: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct Nothing {}

#[derive(Clone)]
pub struct Planner {
    db: std::sync::Arc<Db>,
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

impl Planner {
    fn new(db: Db) -> Self {
        Self {
            db: std::sync::Arc::new(db),
            tool_router: Self::tool_router(),
        }
    }

    fn run<T>(&self, work: impl FnOnce(&mut Connection) -> AppResult<T>) -> Result<T, String> {
        self.db.call(work).map_err(|error| error.to_string())
    }

    /// Runs a tool that writes; each change is one mutation, checked
    /// before it is applied.
    fn write<T>(&self, work: impl FnOnce(&mut Writer) -> AppResult<T>) -> Result<T, String> {
        self.db
            .engine(|engine| work(&mut Writer(engine)))
            .map_err(|error| error.to_string())
    }
}

#[tool_router]
impl Planner {
    #[tool(
        description = "List the Inbox and the active projects, each with its sections and their ids."
    )]
    async fn list_projects(
        &self,
        Parameters(query): Parameters<ListProjects>,
    ) -> Result<String, String> {
        self.run(|conn| {
            let names = Names::load(conn)?;
            let inbox = ProjectView {
                id: None,
                name: "Inbox".to_owned(),
                parent_id: None,
                status: None,
                color: None,
                group: None,
                target_date: None,
                weekly_hours: None,
                stop_if: None,
                archived: false,
                sections: names.sections_of(None),
            };
            let all: Vec<ProjectView> = std::iter::once(inbox)
                .chain(
                    names
                        .projects
                        .iter()
                        .filter(|project| {
                            query.include_archived.unwrap_or(false) || !project.archived
                        })
                        .map(|project| names.project_view(project)),
                )
                .collect();
            to_json(&all)
        })
    }

    #[tool(
        description = "What today looks like: overdue and due tasks, planned blocks, focus so far and the running session."
    )]
    async fn today(&self, Parameters(_): Parameters<Nothing>) -> Result<String, String> {
        self.run(|conn| {
            let today = Date::today();
            let names = Names::load(conn)?;
            let open: Vec<tasks::Task> = tasks::list(conn)?
                .into_iter()
                .filter(|task| task.completed_at.is_none())
                .collect();
            let pick = |keep: &dyn Fn(Date) -> bool| -> Vec<TaskView> {
                open.iter()
                    .filter(|task| task.due_date.is_some_and(keep))
                    .map(|task| view(task, &names))
                    .collect()
            };
            let planned_blocks = blocks::list(conn, today, today.add_days(1))?
                .into_iter()
                .map(|block| SpanView {
                    title: block.title,
                    task_id: Some(block.task_id),
                    start: local_time(block.start_at),
                    end: local_time(block.end_at),
                })
                .collect();
            let (start, end) = (today.start().0, today.add_days(1).start().0);
            let overlap = |from: i64, to: i64| (to.min(end) - from.max(start)).max(0);
            let logged: i64 = time_entries::list(conn, today, today.add_days(1))?
                .iter()
                .map(|entry| overlap(entry.started_at.0, entry.ended_at.0))
                .sum();
            let running = time_entries::running(conn)?;
            let live = running
                .as_ref()
                .filter(|timer| timer.paused_at.is_none())
                .map_or(0, |timer| overlap(timer.started_at.0, Timestamp::now().0));
            let focusing = running.map(|timer| focus_view(conn, &timer)).transpose()?;
            to_json(&TodayView {
                date: today.0.to_string(),
                overdue: pick(&|date| date < today),
                due_today: pick(&|date| date == today),
                planned_blocks,
                focused_minutes: (logged + live) / 60,
                focusing,
            })
        })
    }

    #[tool(description = "Find tasks. Open tasks only unless include_done is set.")]
    async fn list_tasks(&self, Parameters(query): Parameters<ListTasks>) -> Result<String, String> {
        self.run(|conn| {
            let project = query
                .project
                .as_deref()
                .map(|text| resolve_project(conn, text))
                .transpose()?;
            let names = Names::load(conn)?;
            let section_ids: Option<Vec<Id>> = match (query.section.as_deref(), &project) {
                (None, _) => None,
                (Some(text), Some(project_id)) => {
                    Some(vec![resolve_section(conn, project_id.as_ref(), text)?])
                }
                (Some(text), None) => {
                    let ids: Vec<Id> = names
                        .sections
                        .iter()
                        .filter(|section| matches(text.trim(), &section.id, &section.name))
                        .map(|section| section.id.clone())
                        .collect();
                    if ids.is_empty() {
                        return Err(AppError::invalid(format!(
                            "No section called “{}”. Use list_projects to see sections.",
                            text.trim()
                        )));
                    }
                    Some(ids)
                }
            };
            let due_by = optional_date(query.due_by.as_deref())?;
            let search = query.search.as_deref().map(str::to_lowercase);
            let found: Vec<TaskView> = tasks::list(conn)?
                .iter()
                .filter(|task| query.include_done.unwrap_or(false) || task.completed_at.is_none())
                .filter(|task| project.as_ref().is_none_or(|id| &task.project_id == id))
                .filter(|task| {
                    section_ids.as_ref().is_none_or(|ids| {
                        task.section_id.as_ref().is_some_and(|id| ids.contains(id))
                    })
                })
                .filter(|task| due_by.is_none_or(|by| task.due_date.is_some_and(|date| date <= by)))
                .filter(|task| {
                    search.as_deref().is_none_or(|text| {
                        task.title.to_lowercase().contains(text)
                            || task.notes.to_lowercase().contains(text)
                    })
                })
                .take(query.limit.unwrap_or(DEFAULT_LIMIT))
                .map(|task| view(task, &names))
                .collect();
            to_json(&found)
        })
    }

    #[tool(description = "Add a task. Returns the new task.")]
    async fn add_task(&self, Parameters(input): Parameters<AddTask>) -> Result<String, String> {
        self.write(|conn| {
            let parent = input
                .parent_id
                .as_deref()
                .map(|id| tasks::get(conn, &parse_id(id)?))
                .transpose()?;
            if let Some(parent) = &parent {
                check_parent_open(parent, input.under_finished_parent.unwrap_or(false))?;
            }
            let project_id = match (&parent, input.project.as_deref()) {
                (Some(parent), _) => parent.project_id.clone(),
                (None, Some(text)) => resolve_project(conn, text)?,
                (None, None) => None,
            };
            let section_id = match (&parent, input.section.as_deref()) {
                (Some(parent), _) => parent.section_id.clone(),
                (None, Some(text)) => Some(resolve_section(conn, project_id.as_ref(), text)?),
                (None, None) => None,
            };
            let input = tasks::TaskInput {
                title: input.title,
                notes: input.notes.unwrap_or_default(),
                project_id,
                section_id,
                parent_id: parent.map(|parent| parent.id),
                priority: input.priority.unwrap_or(4),
                due_date: optional_date(input.due_date.as_deref())?,
                due_time: input.due_time.as_deref().map(parse_clock).transpose()?,
                deadline: optional_date(input.deadline.as_deref())?,
                recurrence: input.repeat.filter(|repeat| !repeat.trim().is_empty()),
                estimate_minutes: input.estimate_minutes,
            };
            let task: tasks::Task = mutate(conn, "createTask", json!({ "input": input }))?;
            to_json(&view(&task, &Names::load(conn)?))
        })
    }

    #[tool(
        description = "Change a task's title, notes, priority, dates, repeat or estimate, or move it to another project or section. Fields left out stay as they are."
    )]
    async fn update_task(
        &self,
        Parameters(change): Parameters<UpdateTask>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let id = parse_id(&change.id)?;
            let task = tasks::get(conn, &id)?;
            let cleared = |text: &Option<String>| text.as_deref().map(str::trim) == Some("");
            let input = tasks::TaskInput {
                title: change.title.unwrap_or(task.title),
                notes: change.notes.unwrap_or(task.notes),
                project_id: task.project_id,
                section_id: task.section_id,
                parent_id: task.parent_id,
                priority: change.priority.unwrap_or(task.priority),
                due_date: match &change.due_date {
                    Some(_) if cleared(&change.due_date) => None,
                    Some(text) => Some(parse_date(text)?),
                    None => task.due_date,
                },
                due_time: match &change.due_time {
                    Some(_) if cleared(&change.due_time) => None,
                    Some(text) => Some(parse_clock(text)?),
                    None => task.due_time,
                },
                deadline: match &change.deadline {
                    Some(_) if cleared(&change.deadline) => None,
                    Some(text) => Some(parse_date(text)?),
                    None => task.deadline,
                },
                recurrence: match change.repeat {
                    Some(text) if text.trim().is_empty() => None,
                    Some(text) => Some(text),
                    None => task.recurrence,
                },
                estimate_minutes: change.estimate_minutes.or(task.estimate_minutes),
            };
            let mut task: tasks::Task =
                mutate(conn, "updateTask", json!({ "id": id, "input": input }))?;
            if change.project.is_some() || change.section.is_some() {
                let project_id = match change.project.as_deref() {
                    Some(text) => resolve_project(conn, text)?,
                    None => task.project_id.clone(),
                };
                let section_id = match change.section.as_deref().map(str::trim) {
                    Some("") => None,
                    Some(text) => Some(resolve_section(conn, project_id.as_ref(), text)?),
                    None if project_id == task.project_id => task.section_id.clone(),
                    None => None,
                };
                let keeps_parent = project_id == task.project_id && section_id == task.section_id;
                let placement = tasks::TaskPlacement {
                    project_id,
                    section_id,
                    parent_id: if keeps_parent { task.parent_id } else { None },
                    before: None,
                };
                task = mutate(
                    conn,
                    "moveTask",
                    json!({ "id": id, "placement": placement }),
                )?;
            }
            to_json(&view(&task, &Names::load(conn)?))
        })
    }

    #[tool(description = "Mark a task done (or not done). Sub-tasks follow.")]
    async fn complete_task(
        &self,
        Parameters(input): Parameters<CompleteTask>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let task: tasks::Task = mutate(
                conn,
                "setTaskCompleted",
                json!({ "id": parse_id(&input.id)?, "completed": input.done.unwrap_or(true) }),
            )?;
            to_json(&view(&task, &Names::load(conn)?))
        })
    }

    #[tool(description = "Start a focus session, finishing any session already running.")]
    async fn start_focus(
        &self,
        Parameters(input): Parameters<StartFocus>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let details = EntryDetails {
                description: input.description.unwrap_or_default(),
                project_id: None,
                task_id: input.task_id.as_deref().map(parse_id).transpose()?,
            };
            let timer: RunningTimer = mutate(conn, "startTimer", json!({ "details": details }))?;
            to_json(&focus_view(conn, &timer)?)
        })
    }

    #[tool(description = "Stop the running focus session and log it.")]
    async fn stop_focus(&self, Parameters(_): Parameters<Nothing>) -> Result<String, String> {
        self.write(|conn| {
            match mutate::<Option<time_entries::TimeEntry>>(conn, "stopTimer", json!({}))? {
                Some(entry) => Ok(format!(
                    "Logged {} minutes.",
                    entry.started_at.seconds_until(entry.ended_at) / 60
                )),
                None => Ok("No session was running.".to_owned()),
            }
        })
    }

    #[tool(description = "Take a break from the running focus session, or resume it.")]
    async fn toggle_break(&self, Parameters(_): Parameters<Nothing>) -> Result<String, String> {
        self.write(|conn| {
            let current = time_entries::running(conn)?
                .ok_or_else(|| AppError::invalid("No session is running."))?;
            let toggle = match current.paused_at {
                Some(_) => "resumeTimer",
                None => "pauseTimer",
            };
            let timer: RunningTimer = mutate(conn, toggle, json!({}))?;
            to_json(&focus_view(conn, &timer)?)
        })
    }

    #[tool(description = "Focus sessions logged between two days.")]
    async fn focus_history(
        &self,
        Parameters(range): Parameters<FocusHistory>,
    ) -> Result<String, String> {
        self.run(|conn| {
            let from = optional_date(range.from.as_deref())?.unwrap_or_else(Date::today);
            let to = optional_date(range.to.as_deref())?.unwrap_or(from);
            let all = tasks::list(conn)?;
            let sessions: Vec<SpanView> = time_entries::list(conn, from, to.add_days(1))?
                .into_iter()
                .map(|entry| SpanView {
                    title: entry
                        .task_id
                        .as_ref()
                        .and_then(|id| all.iter().find(|task| &task.id == id))
                        .map_or(entry.description, |task| task.title.clone()),
                    task_id: entry.task_id,
                    start: local_time(entry.started_at),
                    end: local_time(entry.ended_at),
                })
                .collect();
            to_json(&sessions)
        })
    }

    #[tool(description = "Create a project. Returns it with its id.")]
    async fn add_project(
        &self,
        Parameters(input): Parameters<AddProject>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let parent_id = match input.parent.as_deref() {
                Some(text) => Some(named_project(conn, text)?.id),
                None => None,
            };
            let color = check_color(input.color.as_deref().unwrap_or("blue"))?;
            let created = projects::ProjectInput {
                name: input.name,
                parent_id: parent_id.clone(),
                color,
            };
            let project: projects::Project =
                mutate(conn, "createProject", json!({ "input": created }))?;
            let mut settings = settings_of(&project);
            if parent_id.is_none() {
                settings.group_id = input
                    .group
                    .as_deref()
                    .map(|text| resolve_group(conn, text))
                    .transpose()?
                    .flatten();
            }
            settings.target_date = optional_date(input.target_date.as_deref())?;
            settings.weekly_minutes = input.weekly_hours.and_then(hours_to_minutes);
            settings.kill_criteria = input.stop_if.unwrap_or_default();
            let project: projects::Project = mutate(
                conn,
                "updateProjectSettings",
                json!({ "id": project.id, "settings": settings }),
            )?;
            to_json(&Names::load(conn)?.project_view(&project))
        })
    }

    #[tool(
        description = "Change a project: name, colour, parent, group, status, target date, weekly hours, stop rule, or archive it. Fields left out stay as they are."
    )]
    async fn update_project(
        &self,
        Parameters(change): Parameters<UpdateProject>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let mut project = named_project(conn, &change.project)?;
            let id = project.id.clone();
            if change.name.is_some() || change.color.is_some() || change.parent.is_some() {
                let parent_id = match change.parent.as_deref().map(str::trim) {
                    Some("") => None,
                    Some(text) => Some(named_project(conn, text)?.id),
                    None => project.parent_id.clone(),
                };
                let color = match change.color.as_deref() {
                    Some(text) => check_color(text)?,
                    None => project.color.clone(),
                };
                let input = projects::ProjectInput {
                    name: change.name.clone().unwrap_or(project.name.clone()),
                    parent_id,
                    color,
                };
                project = mutate(conn, "updateProject", json!({ "id": id, "input": input }))?;
            }
            let mut settings = settings_of(&project);
            if let Some(text) = change.group.as_deref() {
                if project.parent_id.is_some() {
                    return Err(AppError::invalid(
                        "Only top-level projects have a group; sub-projects follow theirs.",
                    ));
                }
                settings.group_id = resolve_group(conn, text)?;
            }
            if let Some(status) = change.status {
                settings.status = status.trim().to_lowercase();
            }
            if change.target_date.is_some() {
                settings.target_date = optional_date(change.target_date.as_deref())?;
            }
            if let Some(hours) = change.weekly_hours {
                settings.weekly_minutes = hours_to_minutes(hours);
            }
            if let Some(text) = change.stop_if {
                settings.kill_criteria = text.trim().to_owned();
            }
            project = mutate(
                conn,
                "updateProjectSettings",
                json!({ "id": id, "settings": settings }),
            )?;
            if let Some(archived) = change.archived {
                mutate::<()>(
                    conn,
                    "setProjectArchived",
                    json!({ "id": id, "archived": archived }),
                )?;
                project = projects::get(conn, &id)?;
            }
            to_json(&Names::load(conn)?.project_view(&project))
        })
    }

    #[tool(description = "Add a section to a project or the Inbox.")]
    async fn add_section(
        &self,
        Parameters(input): Parameters<AddSection>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let project_id = resolve_project(conn, &input.project)?;
            let section: sections::Section = mutate(
                conn,
                "createSection",
                json!({ "projectId": project_id, "name": input.name, "before": null }),
            )?;
            to_json(&SectionView {
                id: section.id,
                name: section.name,
            })
        })
    }

    #[tool(description = "Rename a section.")]
    async fn rename_section(
        &self,
        Parameters(input): Parameters<RenameSection>,
    ) -> Result<String, String> {
        self.write(|conn| {
            let project_id = resolve_project(conn, &input.project)?;
            let id = resolve_section(conn, project_id.as_ref(), &input.section)?;
            let section: sections::Section = mutate(
                conn,
                "renameSection",
                json!({ "id": id, "name": input.name }),
            )?;
            to_json(&SectionView {
                id: section.id,
                name: section.name,
            })
        })
    }
}

#[tool_handler]
impl ServerHandler for Planner {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("skkil-time", env!("CARGO_PKG_VERSION")))
            .with_instructions(INSTRUCTIONS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_dates_and_times() {
        assert_eq!(parse_date("tomorrow").unwrap(), Date::today().add_days(1));
        assert_eq!(
            parse_date("2026-11-09").unwrap().0.to_string(),
            "2026-11-09"
        );
        assert!(parse_date("next week").is_err());
        assert_eq!(parse_clock("09:30").unwrap(), 570);
        assert!(parse_clock("24:00").is_err());
        assert_eq!(optional_date(Some("")).unwrap(), None);
    }

    #[test]
    fn finds_projects_by_name_or_id() {
        let db = Db::new(Engine::in_memory().unwrap());
        db.engine(|engine| {
            let conn = &mut Writer(engine);
            let thesis: projects::Project = mutate(
                conn,
                "createProject",
                json!({ "input": { "name": "Thesis", "parentId": null, "color": "blue" } }),
            )?;
            assert_eq!(resolve_project(conn, "thesis")?, Some(thesis.id.clone()));
            assert_eq!(
                resolve_project(conn, thesis.id.as_str())?,
                Some(thesis.id.clone())
            );
            assert_eq!(resolve_project(conn, "Inbox")?, None);
            let missing = resolve_project(conn, "Home").unwrap_err().to_string();
            assert!(missing.contains("Projects: Inbox, Thesis."));
            let drafts: sections::Section = mutate(
                conn,
                "createSection",
                json!({ "projectId": thesis.id, "name": "Drafts", "before": null }),
            )?;
            assert_eq!(
                resolve_section(conn, Some(&thesis.id), "drafts")?,
                drafts.id
            );
            assert!(resolve_section(conn, None, "Drafts").is_err());
            let missing = resolve_section(conn, Some(&thesis.id), "Ideas")
                .unwrap_err()
                .to_string();
            assert!(missing.contains("Sections: Drafts."));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn asks_before_adding_under_a_finished_task() {
        let db = Db::new(Engine::in_memory().unwrap());
        db.engine(|engine| {
            let conn = &mut Writer(engine);
            let parent: tasks::Task = mutate(
                conn,
                "createTask",
                json!({ "input": { "title": "Apply", "notes": "", "projectId": null, "sectionId": null, "parentId": null, "priority": 4, "dueDate": null, "dueTime": null, "deadline": null, "recurrence": null, "estimateMinutes": null } }),
            )?;
            assert!(check_parent_open(&parent, false).is_ok());
            let parent: tasks::Task = mutate(
                conn,
                "setTaskCompleted",
                json!({ "id": parent.id, "completed": true }),
            )?;
            let refused = check_parent_open(&parent, false).unwrap_err().to_string();
            assert!(refused.contains("Ask the user first"));
            assert!(check_parent_open(&parent, true).is_ok());
            Ok(())
        })
        .unwrap();
    }
}
