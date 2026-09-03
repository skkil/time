use std::collections::HashMap;

use chrono::{Datelike, Days};
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, optional_text, projects, required_text};
use crate::activitywatch::{self, Usage};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Date, Id, Timestamp};

const KINDS: [&str; 3] = ["build", "quit", "limit"];
const UNITS: [&str; 2] = ["times", "minutes"];
const TIMES_OF_DAY: [&str; 4] = ["anytime", "morning", "afternoon", "evening"];
const SYNC_DAYS: u64 = 60;
const ALL_DAYS: i32 = 0b111_1111;
const CONSISTENCY_DAYS: i64 = 14;
const MAX_SKIP_DAYS: i32 = 2;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Tracking {
    pub source: String,
    pub patterns: Vec<String>,
    pub project_id: Option<Id>,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Habit {
    pub id: Id,
    pub name: String,
    pub kind: String,
    pub goal: f64,
    pub unit: String,
    pub days: i32,
    pub time_of_day: String,
    pub area: String,
    pub start_date: Date,
    pub tracking: Option<Tracking>,
    pub skip_days: i32,
    pub anchor: String,
    pub done_days: i32,
    pub due_days: i32,
    pub clean_since: Option<Date>,
}

#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HabitInput {
    pub name: String,
    pub kind: String,
    pub goal: f64,
    pub unit: String,
    pub days: i32,
    pub time_of_day: String,
    pub area: String,
    pub start_date: Date,
    pub tracking: Option<Tracking>,
    pub skip_days: i32,
    pub anchor: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DayStatus {
    Done,
    Failed,
    Skipped,
    Pending,
    Missed,
    Off,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ManualStatus {
    Done,
    Failed,
    Skipped,
}

impl ManualStatus {
    fn as_str(self) -> &'static str {
        match self {
            ManualStatus::Done => "done",
            ManualStatus::Failed => "failed",
            ManualStatus::Skipped => "skipped",
        }
    }
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HabitDay {
    pub habit_id: Id,
    pub date: Date,
    pub status: DayStatus,
    pub value: f64,
    pub manual: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TrackerState {
    NotNeeded,
    Connected,
    Unreachable,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub activitywatch: TrackerState,
    pub has_web_data: bool,
    pub has_window_data: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
struct Log {
    status: Option<String>,
    value: f64,
}

const SELECT: &str = "SELECT id, name, kind, goal, unit, days, time_of_day, area, start_date,
       track_source, track_patterns, track_project_id, skip_days, anchor
     FROM habit";

fn from_row(row: &Row) -> rusqlite::Result<Habit> {
    let source: Option<String> = row.get(9)?;
    let patterns: String = row.get(10)?;
    Ok(Habit {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        goal: row.get(3)?,
        unit: row.get(4)?,
        days: row.get(5)?,
        time_of_day: row.get(6)?,
        area: row.get(7)?,
        start_date: row.get(8)?,
        tracking: source.map(|source| Tracking {
            source,
            patterns: patterns
                .split('\n')
                .filter(|p| !p.is_empty())
                .map(str::to_owned)
                .collect(),
            project_id: row.get(11).ok().flatten(),
        }),
        skip_days: row.get(12)?,
        anchor: row.get(13)?,
        done_days: 0,
        due_days: 0,
        clean_since: None,
    })
}

fn scheduled(habit: &Habit, date: Date) -> bool {
    habit.days & (1 << date.0.weekday().num_days_from_monday()) != 0
}

fn status(habit: &Habit, date: Date, today: Date, log: Option<&Log>) -> DayStatus {
    if date > today || date < habit.start_date {
        return DayStatus::Off;
    }
    match log.and_then(|log| log.status.as_deref()) {
        Some("done") => return DayStatus::Done,
        Some("failed") => return DayStatus::Failed,
        Some("skipped") => return DayStatus::Skipped,
        _ => {}
    }
    if !scheduled(habit, date) {
        return DayStatus::Off;
    }
    let value = log.map_or(0.0, |log| log.value);
    let past = date < today;
    if habit.kind == "build" {
        if value >= habit.goal {
            DayStatus::Done
        } else if past {
            DayStatus::Missed
        } else {
            DayStatus::Pending
        }
    } else if value > habit.goal {
        DayStatus::Failed
    } else if past {
        DayStatus::Done
    } else {
        DayStatus::Pending
    }
}

fn logs_for(conn: &Connection, habit_id: Id) -> Result<HashMap<Date, Log>> {
    let mut stmt = conn.prepare("SELECT date, status, value FROM habit_log WHERE habit_id = ?1")?;
    let rows = stmt.query_map(params![habit_id], |row| {
        Ok((
            row.get::<_, Date>(0)?,
            Log {
                status: row.get(1)?,
                value: row.get(2)?,
            },
        ))
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn with_stats(conn: &Connection, mut habit: Habit, today: Date) -> Result<Habit> {
    let logs = logs_for(conn, habit.id)?;
    let mut forgiven: HashMap<Date, i32> = HashMap::new();
    let (mut done_days, mut due_days) = (0, 0);
    let mut date = today.add_days(1 - CONSISTENCY_DAYS).max(habit.start_date);
    while date <= today {
        match status(&habit, date, today, logs.get(&date)) {
            DayStatus::Done => {
                done_days += 1;
                due_days += 1;
            }
            DayStatus::Failed => due_days += 1,
            DayStatus::Missed => {
                let used = forgiven.entry(date.monday()).or_default();
                if *used < habit.skip_days {
                    *used += 1;
                } else {
                    due_days += 1;
                }
            }
            _ => {}
        }
        date = date.add_days(1);
    }
    let mut last_failure: Option<Date> = None;
    let mut date = today;
    while date >= habit.start_date && habit.kind != "build" {
        if status(&habit, date, today, logs.get(&date)) == DayStatus::Failed {
            last_failure = Some(date);
            break;
        }
        date = Date(date.0 - Days::new(1));
    }
    habit.done_days = done_days;
    habit.due_days = due_days;
    habit.clean_since = (habit.kind != "build")
        .then(|| last_failure.map_or(habit.start_date, |day| Date(day.0 + Days::new(1))));
    Ok(habit)
}

pub fn get(conn: &Connection, id: Id) -> Result<Habit> {
    let habit = conn
        .query_row(&format!("{SELECT} WHERE id = ?1"), params![id], from_row)
        .optional()?
        .ok_or_else(|| Error::not_found("Habit"))?;
    with_stats(conn, habit, Date::today())
}

fn active(conn: &Connection) -> Result<Vec<Habit>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT} WHERE archived = 0 ORDER BY position, id"
    ))?;
    let rows = stmt.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn list(conn: &Connection) -> Result<Vec<Habit>> {
    let today = Date::today();
    active(conn)?
        .into_iter()
        .map(|habit| with_stats(conn, habit, today))
        .collect()
}

struct Valid {
    name: String,
    goal: f64,
    unit: String,
    area: String,
    anchor: String,
    tracking: Option<Tracking>,
}

fn validate(conn: &Connection, input: &HabitInput) -> Result<Valid> {
    let name = required_text(&input.name, "Habit name", 80)?;
    if !KINDS.contains(&input.kind.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown habit type: {}",
            input.kind
        )));
    }
    if !UNITS.contains(&input.unit.as_str()) {
        return Err(Error::invalid(format!("Unknown unit: {}", input.unit)));
    }
    if !TIMES_OF_DAY.contains(&input.time_of_day.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown time of day: {}",
            input.time_of_day
        )));
    }
    if !(1..=ALL_DAYS).contains(&input.days) {
        return Err(Error::invalid("Pick at least one day."));
    }
    let in_range = input.goal.is_finite() && (0.0..=100_000.0).contains(&input.goal);
    let goal = match input.kind.as_str() {
        "quit" => 0.0,
        _ if !in_range => return Err(Error::invalid("That goal is out of range.")),
        "build" if input.goal == 0.0 => {
            return Err(Error::invalid("A goal must be more than zero."));
        }
        _ => input.goal,
    };
    if !(0..=MAX_SKIP_DAYS).contains(&input.skip_days) {
        return Err(Error::invalid("Allow at most two skip days a week."));
    }
    let anchor = optional_text(&input.anchor, "Anchor", 120)?;
    let area = input.area.trim().chars().take(40).collect();
    let mut unit = input.unit.clone();

    let tracking = match &input.tracking {
        None => None,
        Some(tracking) => {
            let patterns: Vec<String> = match tracking.source.as_str() {
                "website" => tracking
                    .patterns
                    .iter()
                    .map(|p| activitywatch::normalize_domain(p))
                    .filter(|p| !p.is_empty())
                    .collect(),
                "app" => tracking
                    .patterns
                    .iter()
                    .map(|p| p.trim().to_owned())
                    .filter(|p| !p.is_empty())
                    .collect(),
                "project" => Vec::new(),
                other => return Err(Error::invalid(format!("Unknown tracking source: {other}"))),
            };
            if tracking.source == "project" {
                let project_id = tracking
                    .project_id
                    .ok_or_else(|| Error::invalid("Pick a project to track."))?;
                projects::get(conn, project_id)?;
                unit = "minutes".into();
            } else if patterns.is_empty() {
                return Err(Error::invalid(if tracking.source == "website" {
                    "Add at least one website."
                } else {
                    "Add at least one app name."
                }));
            }
            Some(Tracking {
                source: tracking.source.clone(),
                patterns,
                project_id: tracking.project_id.filter(|_| tracking.source == "project"),
            })
        }
    };
    Ok(Valid {
        name,
        goal,
        unit,
        area,
        anchor,
        tracking,
    })
}

fn write(conn: &Connection, id: Option<Id>, input: &HabitInput) -> Result<Id> {
    let valid = validate(conn, input)?;
    let (source, patterns, project_id) = match &valid.tracking {
        Some(t) => (Some(t.source.as_str()), t.patterns.join("\n"), t.project_id),
        None => (None, String::new(), None),
    };
    let values = params![
        valid.name,
        input.kind,
        valid.goal,
        valid.unit,
        input.days,
        input.time_of_day,
        valid.area,
        input.start_date,
        source,
        patterns,
        project_id,
        input.skip_days,
        valid.anchor,
    ];
    match id {
        None => {
            conn.execute(
                "INSERT INTO habit (name, kind, goal, unit, days, time_of_day, area, start_date,
                                    track_source, track_patterns, track_project_id, skip_days,
                                    anchor, position)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                         (SELECT COALESCE(MAX(position), 0) + 1 FROM habit))",
                values,
            )?;
            Ok(Id(conn.last_insert_rowid()))
        }
        Some(id) => {
            let rows = conn.execute(
                "UPDATE habit SET name = ?1, kind = ?2, goal = ?3, unit = ?4, days = ?5,
                                  time_of_day = ?6, area = ?7, start_date = ?8, track_source = ?9,
                                  track_patterns = ?10, track_project_id = ?11, skip_days = ?12,
                                  anchor = ?13
                 WHERE id = ?14",
                params![
                    valid.name,
                    input.kind,
                    valid.goal,
                    valid.unit,
                    input.days,
                    input.time_of_day,
                    valid.area,
                    input.start_date,
                    source,
                    patterns,
                    project_id,
                    input.skip_days,
                    valid.anchor,
                    id
                ],
            )?;
            ensure_changed(rows, "Habit")?;
            Ok(id)
        }
    }
}

pub fn create(conn: &Connection, input: &HabitInput) -> Result<Habit> {
    let id = write(conn, None, input)?;
    get(conn, id)
}

pub fn update(conn: &mut Connection, id: Id, input: &HabitInput) -> Result<Habit> {
    let before = get(conn, id)?;
    let tx = conn.transaction()?;
    write(&tx, Some(id), input)?;
    let tracking_changed = before.tracking != get(&tx, id)?.tracking;
    if tracking_changed {
        tx.execute(
            "DELETE FROM habit_log WHERE habit_id = ?1 AND source = 'auto' AND status IS NULL",
            params![id],
        )?;
    }
    tx.commit()?;
    get(conn, id)
}

pub fn archive(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("UPDATE habit SET archived = 1 WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Habit")
}

pub fn days(conn: &Connection, from: Date, to: Date) -> Result<Vec<HabitDay>> {
    let today = Date::today();
    let mut logs: HashMap<(Id, Date), (Log, bool)> = HashMap::new();
    let mut stmt = conn.prepare(
        "SELECT habit_id, date, status, value, source FROM habit_log WHERE date >= ?1 AND date < ?2",
    )?;
    let rows = stmt.query_map(params![from, to], |row| {
        Ok((
            (row.get::<_, Id>(0)?, row.get::<_, Date>(1)?),
            (
                Log {
                    status: row.get(2)?,
                    value: row.get(3)?,
                },
                row.get::<_, String>(4)? == "manual",
            ),
        ))
    })?;
    for row in rows {
        let (key, value) = row?;
        logs.insert(key, value);
    }

    let mut result = Vec::new();
    for habit in active(conn)? {
        let mut date = from;
        while date < to {
            let entry = logs.get(&(habit.id, date));
            let log = entry.map(|(log, _)| log);
            result.push(HabitDay {
                habit_id: habit.id,
                date,
                status: status(&habit, date, today, log),
                value: log.map_or(0.0, |log| log.value),
                manual: entry.is_some_and(|(log, manual)| *manual || log.status.is_some()),
            });
            date = Date(date.0 + Days::new(1));
        }
    }
    Ok(result)
}

fn ensure_loggable(date: Date) -> Result<()> {
    if date > Date::today() {
        return Err(Error::invalid("Habits can't be logged ahead of time."));
    }
    Ok(())
}

pub fn set_status(
    conn: &Connection,
    habit_id: Id,
    date: Date,
    status: Option<ManualStatus>,
) -> Result<()> {
    ensure_loggable(date)?;
    get(conn, habit_id)?;
    conn.execute(
        "INSERT INTO habit_log (habit_id, date, status) VALUES (?1, ?2, ?3)
         ON CONFLICT(habit_id, date) DO UPDATE SET status = excluded.status",
        params![habit_id, date, status.map(ManualStatus::as_str)],
    )?;
    Ok(())
}

pub fn add_value(conn: &Connection, habit_id: Id, date: Date, delta: f64) -> Result<()> {
    ensure_loggable(date)?;
    let habit = get(conn, habit_id)?;
    if habit.tracking.is_some() {
        return Err(Error::invalid("This habit is tracked automatically."));
    }
    conn.execute(
        "INSERT INTO habit_log (habit_id, date, value) VALUES (?1, ?2, MAX(0, ?3))
         ON CONFLICT(habit_id, date) DO UPDATE SET value = MAX(0, value + ?3)",
        params![habit_id, date, delta],
    )?;
    Ok(())
}

fn record_auto(conn: &Connection, habit_id: Id, date: Date, value: f64) -> Result<()> {
    conn.execute(
        "INSERT INTO habit_log (habit_id, date, value, source) VALUES (?1, ?2, ?3, 'auto')
         ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value,
           source = CASE WHEN habit_log.status IS NULL THEN 'auto' ELSE habit_log.source END",
        params![habit_id, date, value],
    )?;
    Ok(())
}

fn sync_window(habit: &Habit, today: Date) -> Vec<Date> {
    let earliest = Date(today.0 - Days::new(SYNC_DAYS));
    let mut date = habit.start_date.max(earliest);
    let mut days = Vec::new();
    while date <= today {
        days.push(date);
        date = Date(date.0 + Days::new(1));
    }
    days
}

fn measure(habit: &Habit, usage: Usage) -> f64 {
    if habit.unit == "times" {
        f64::from(usage.visits)
    } else {
        (usage.seconds / 6.0).round() / 10.0
    }
}

fn project_minutes(conn: &Connection, project_id: Id, day: Date) -> Result<f64> {
    let from = day.start();
    let to = Date(day.0 + Days::new(1)).start();
    let seconds: i64 = conn.query_row(
        "WITH RECURSIVE tree(id) AS (
           SELECT ?1 UNION ALL SELECT p.id FROM project p JOIN tree ON p.parent_id = tree.id
         )
         SELECT COALESCE(SUM(MIN(ended_at, ?3) - MAX(started_at, ?2)), 0)
         FROM time_entry
         WHERE project_id IN (SELECT id FROM tree) AND ended_at > ?2 AND started_at < ?3",
        params![project_id, from, to],
        |row| row.get(0),
    )?;
    Ok((seconds as f64 / 6.0).round() / 10.0)
}

pub fn sync_projects(conn: &Connection, habits: &[Habit], today: Date) -> Result<()> {
    for habit in habits {
        let Some(project_id) = habit.tracking.as_ref().and_then(|t| t.project_id) else {
            continue;
        };
        for day in sync_window(habit, today) {
            record_auto(conn, habit.id, day, project_minutes(conn, project_id, day)?)?;
        }
    }
    Ok(())
}

pub fn apply_activity(
    conn: &mut Connection,
    habits: &[Habit],
    web: &[activitywatch::Event],
    windows: &[activitywatch::Event],
    today: Date,
) -> Result<()> {
    let tx = conn.transaction()?;
    for habit in habits {
        let Some(tracking) = &habit.tracking else {
            continue;
        };
        let days = sync_window(habit, today);
        let usage = match tracking.source.as_str() {
            "website" => activitywatch::usage_by_day(
                web,
                |event| activitywatch::matches_website(event, &tracking.patterns),
                &days,
            ),
            "app" => activitywatch::usage_by_day(
                windows,
                |event| activitywatch::matches_app(event, &tracking.patterns),
                &days,
            ),
            _ => continue,
        };
        for day in days {
            record_auto(&tx, habit.id, day, measure(habit, usage[&day]))?;
        }
    }
    tx.commit()?;
    Ok(())
}

fn fetch_activity(
    habits: &[Habit],
    today: Date,
) -> Result<(Vec<activitywatch::Event>, Vec<activitywatch::Event>)> {
    let start = habits
        .iter()
        .flat_map(|habit| sync_window(habit, today).first().copied())
        .min()
        .unwrap_or(today)
        .start();
    let end = Timestamp(Date(today.0 + Days::new(1)).start().0);
    let needs = |source: &str| {
        habits
            .iter()
            .any(|h| h.tracking.as_ref().is_some_and(|t| t.source == source))
    };
    let web = if needs("website") {
        activitywatch::events(activitywatch::WEB_BUCKET, start, end)?
    } else {
        Vec::new()
    };
    let windows = if needs("app") {
        activitywatch::events(activitywatch::WINDOW_BUCKET, start, end)?
    } else {
        Vec::new()
    };
    Ok((web, windows))
}

#[tauri::command]
#[specta::specta]
pub async fn list_habits(db: State<'_, Db>) -> Result<Vec<Habit>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn create_habit(db: State<'_, Db>, input: HabitInput) -> Result<Habit> {
    db.call(|conn| create(conn, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn update_habit(db: State<'_, Db>, id: Id, input: HabitInput) -> Result<Habit> {
    db.call(|conn| update(conn, id, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn archive_habit(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| archive(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn list_habit_days(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<HabitDay>> {
    db.call(|conn| days(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn set_habit_status(
    db: State<'_, Db>,
    habit_id: Id,
    date: Date,
    status: Option<ManualStatus>,
) -> Result<()> {
    db.call(|conn| set_status(conn, habit_id, date, status))
}

#[tauri::command]
#[specta::specta]
pub async fn add_habit_value(
    db: State<'_, Db>,
    habit_id: Id,
    date: Date,
    delta: f64,
) -> Result<()> {
    db.call(|conn| add_value(conn, habit_id, date, delta))
}

#[tauri::command]
#[specta::specta]
pub async fn sync_habits(db: State<'_, Db>) -> Result<SyncReport> {
    let today = Date::today();
    let tracked: Vec<Habit> = db.call(|conn| {
        let habits: Vec<Habit> = active(conn)?
            .into_iter()
            .filter(|habit| habit.tracking.is_some())
            .collect();
        sync_projects(conn, &habits, today)?;
        Ok(habits)
    })?;
    let watched: Vec<Habit> = tracked
        .into_iter()
        .filter(|habit| {
            habit
                .tracking
                .as_ref()
                .is_some_and(|t| t.source != "project")
        })
        .collect();
    if watched.is_empty() {
        return Ok(SyncReport {
            activitywatch: TrackerState::NotNeeded,
            has_web_data: false,
            has_window_data: false,
            message: None,
        });
    }
    let fetch_for = watched.clone();
    let fetched = tauri::async_runtime::spawn_blocking(move || fetch_activity(&fetch_for, today))
        .await
        .map_err(|error| Error::invalid(format!("Sync stopped: {error}")))?;
    match fetched {
        Ok((web, windows)) => {
            db.call(|conn| apply_activity(conn, &watched, &web, &windows, today))?;
            Ok(SyncReport {
                activitywatch: TrackerState::Connected,
                has_web_data: !web.is_empty(),
                has_window_data: !windows.is_empty(),
                message: None,
            })
        }
        Err(error) => Ok(SyncReport {
            activitywatch: TrackerState::Unreachable,
            has_web_data: false,
            has_window_data: false,
            message: Some(error.to_string()),
        }),
    }
}

#[cfg(test)]
pub fn input(name: &str, kind: &str) -> HabitInput {
    HabitInput {
        name: name.into(),
        kind: kind.into(),
        goal: 1.0,
        unit: "times".into(),
        days: ALL_DAYS,
        time_of_day: "anytime".into(),
        area: String::new(),
        start_date: Date::today().add_days(-10),
        tracking: None,
        skip_days: 0,
        anchor: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::activitywatch::Event;
    use crate::features::{projects::ProjectInput, time_entries};

    fn status_on(conn: &Connection, habit: Id, date: Date) -> DayStatus {
        days(conn, date, date.add_days(1))
            .unwrap()
            .into_iter()
            .find(|day| day.habit_id == habit)
            .unwrap()
            .status
    }

    #[test]
    fn build_habits_count_toward_a_goal() {
        let db = Db::in_memory();
        db.call(|conn| {
            let mut water = input("Drink water", "build");
            water.goal = 3.0;
            let water = create(conn, &water)?;
            let today = Date::today();
            add_value(conn, water.id, today, 2.0)?;
            assert_eq!(status_on(conn, water.id, today), DayStatus::Pending);
            add_value(conn, water.id, today, 1.0)?;
            assert_eq!(status_on(conn, water.id, today), DayStatus::Done);
            assert_eq!(
                status_on(conn, water.id, today.add_days(-1)),
                DayStatus::Missed
            );
            set_status(
                conn,
                water.id,
                today.add_days(-1),
                Some(ManualStatus::Skipped),
            )?;
            assert_eq!(
                status_on(conn, water.id, today.add_days(-1)),
                DayStatus::Skipped
            );
            let water = get(conn, water.id)?;
            assert_eq!((water.done_days, water.due_days), (1, 10));
            assert!(add_value(conn, water.id, today.add_days(1), 1.0).is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn quit_habits_hold_until_a_slip() {
        let db = Db::in_memory();
        db.call(|conn| {
            let habit = create(conn, &input("No doomscrolling", "quit"))?;
            let today = Date::today();
            assert_eq!(habit.goal, 0.0);
            assert_eq!(
                status_on(conn, habit.id, today.add_days(-3)),
                DayStatus::Done
            );
            assert_eq!(status_on(conn, habit.id, today), DayStatus::Pending);
            assert_eq!((habit.done_days, habit.due_days), (10, 10));
            assert_eq!(habit.clean_since, Some(today.add_days(-10)));

            set_status(
                conn,
                habit.id,
                today.add_days(-4),
                Some(ManualStatus::Failed),
            )?;
            let habit = get(conn, habit.id)?;
            assert_eq!((habit.done_days, habit.due_days), (9, 10));
            assert_eq!(habit.clean_since, Some(today.add_days(-3)));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn planned_skip_days_forgive_one_miss_a_week() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = Date::today();
            let mut walk = input("Walk", "build");
            walk.start_date = today.add_days(-6);
            walk.skip_days = 1;
            walk.anchor = "After lunch".into();
            let walk = create(conn, &walk)?;
            let weeks: std::collections::HashSet<_> =
                (1..=6).map(|back| today.add_days(-back).monday()).collect();
            assert_eq!(walk.done_days, 0);
            assert_eq!(walk.due_days, 6 - weeks.len() as i32);
            assert_eq!(walk.anchor, "After lunch");

            walk_input_rejects_three_skips(conn)
        })
        .unwrap();
    }

    fn walk_input_rejects_three_skips(conn: &mut Connection) -> Result<()> {
        let mut walk = input("Walk", "build");
        walk.skip_days = 3;
        assert!(create(conn, &walk).is_err());
        Ok(())
    }

    #[test]
    fn repeat_days_turn_other_days_off() {
        let db = Db::in_memory();
        db.call(|conn| {
            let mut gym = input("Gym", "build");
            let today = Date::today();
            gym.days = 1 << today.0.weekday().num_days_from_monday();
            let gym = create(conn, &gym)?;
            assert_eq!(status_on(conn, gym.id, today), DayStatus::Pending);
            assert_eq!(status_on(conn, gym.id, today.add_days(-1)), DayStatus::Off);
            assert_eq!(
                status_on(conn, gym.id, today.add_days(-7)),
                DayStatus::Missed
            );
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn website_tracking_fails_a_quit_habit_and_respects_overrides() {
        let db = Db::in_memory();
        db.call(|conn| {
            let mut quit = input("Stay off YouTube", "quit");
            quit.tracking = Some(Tracking {
                source: "website".into(),
                patterns: vec!["https://www.YouTube.com/feed".into()],
                project_id: None,
            });
            let quit = create(conn, &quit)?;
            assert_eq!(quit.tracking.as_ref().unwrap().patterns, ["youtube.com"]);

            let today = Date::today();
            let yesterday = today.add_days(-1);
            let at = |day: Date, url: &str| Event {
                timestamp: chrono::DateTime::from_timestamp(day.start().0 + 3600, 0).unwrap(),
                duration: 120.0,
                data: json!({ "url": url }),
            };
            let web = vec![
                at(yesterday, "https://m.youtube.com/watch"),
                at(today, "https://docs.rs/"),
            ];
            apply_activity(conn, &[get(conn, quit.id)?], &web, &[], today)?;

            assert_eq!(status_on(conn, quit.id, yesterday), DayStatus::Failed);
            assert_eq!(status_on(conn, quit.id, today), DayStatus::Pending);
            assert_eq!(get(conn, quit.id)?.clean_since, Some(today));
            assert!(add_value(conn, quit.id, today, 1.0).is_err());

            set_status(conn, quit.id, yesterday, Some(ManualStatus::Skipped))?;
            apply_activity(conn, &[get(conn, quit.id)?], &web, &[], today)?;
            assert_eq!(status_on(conn, quit.id, yesterday), DayStatus::Skipped);
            set_status(conn, quit.id, yesterday, None)?;
            assert_eq!(status_on(conn, quit.id, yesterday), DayStatus::Failed);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn limit_habits_allow_usage_up_to_the_goal() {
        let db = Db::in_memory();
        db.call(|conn| {
            let mut games = input("Games under 30 min", "limit");
            games.goal = 30.0;
            games.unit = "minutes".into();
            games.tracking = Some(Tracking {
                source: "app".into(),
                patterns: vec!["steam".into()],
                project_id: None,
            });
            let games = create(conn, &games)?;
            let today = Date::today();
            let play = |day: Date, minutes: f64| Event {
                timestamp: chrono::DateTime::from_timestamp(day.start().0 + 7200, 0).unwrap(),
                duration: minutes * 60.0,
                data: json!({ "app": "steam", "title": "Library" }),
            };
            let windows = vec![
                play(today.add_days(-2), 20.0),
                play(today.add_days(-1), 45.0),
            ];
            apply_activity(conn, &[get(conn, games.id)?], &[], &windows, today)?;
            assert_eq!(
                status_on(conn, games.id, today.add_days(-2)),
                DayStatus::Done
            );
            assert_eq!(
                status_on(conn, games.id, today.add_days(-1)),
                DayStatus::Failed
            );
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn project_time_completes_a_build_habit() {
        let db = Db::in_memory();
        db.call(|conn| {
            let study = projects::create(
                conn,
                &ProjectInput {
                    name: "Study".into(),
                    parent_id: None,
                    color: "green".into(),
                },
            )?;
            let mut habit = input("Study 1h", "build");
            habit.goal = 60.0;
            habit.unit = "times".into();
            habit.tracking = Some(Tracking {
                source: "project".into(),
                patterns: Vec::new(),
                project_id: Some(study.id),
            });
            let habit = create(conn, &habit)?;
            assert_eq!(habit.unit, "minutes");

            let yesterday = Date::today().add_days(-1);
            let start = yesterday.start().0 + 9 * 3600;
            time_entries::create(
                conn,
                &time_entries::EntryInput {
                    details: time_entries::EntryDetails {
                        description: "Chapter 3".into(),
                        project_id: Some(study.id),
                        task_id: None,
                    },
                    started_at: Timestamp(start),
                    ended_at: Timestamp(start + 75 * 60),
                },
            )?;
            sync_projects(conn, &[get(conn, habit.id)?], Date::today())?;
            assert_eq!(status_on(conn, habit.id, yesterday), DayStatus::Done);
            Ok(())
        })
        .unwrap();
    }
}
