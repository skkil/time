use chrono::{Datelike, Local, Timelike};
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, read_setting, write_setting};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Date, Id, Timestamp};

pub const KINDS: [&str; 5] = ["weekly", "morning", "evening", "wind_down", "session"];
pub const TRIGGERS: [&str; 5] = [
    "first_open",
    "at_time",
    "end_of_day",
    "after_timer_stop",
    "manual",
];
pub const STEPS: [&str; 12] = [
    "feel",
    "what_moved",
    "leftovers",
    "pick_musts",
    "timeblock",
    "one_line_note",
    "habit_check",
    "breathing_pause",
    "next_step_note",
    "did_it_move",
    "brain_dump",
    "device_away",
];
const SNOOZE_SECONDS: i64 = 15 * 60;
const END_OF_DAY_EARLIEST_BEFORE: i32 = 120;
const PLANNING_SETTING: &str = "planning_time";

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Ritual {
    pub kind: String,
    pub enabled: bool,
    pub trigger: String,
    pub at_minute: i32,
    pub weekdays: i32,
    pub min_minutes: i32,
    pub steps: Vec<String>,
}

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RitualInput {
    pub enabled: bool,
    pub trigger: String,
    pub at_minute: i32,
    pub weekdays: i32,
    pub steps: Vec<String>,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RitualRun {
    pub id: Id,
    pub kind: String,
    pub date: Date,
    pub task_id: Option<Id>,
    pub started_at: Timestamp,
    pub finished_at: Option<Timestamp>,
    pub skipped: bool,
    pub step: i32,
    pub snoozed_until: Option<Timestamp>,
}

#[derive(Debug, Clone, Copy, Deserialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum RitualEvent {
    Open,
    Tick,
    TimerStopped { minutes: i32 },
}

#[derive(Debug, Clone, Copy)]
pub struct Moment {
    pub date: Date,
    pub minute: i32,
    pub stamp: Timestamp,
}

impl Moment {
    fn now() -> Self {
        let now = Local::now();
        Self {
            date: Date(now.date_naive()),
            minute: (now.hour() * 60 + now.minute()) as i32,
            stamp: Timestamp(now.timestamp()),
        }
    }
}

const SELECT: &str =
    "SELECT kind, enabled, trigger, at_minute, weekdays, min_minutes, steps FROM ritual";
const SELECT_RUN: &str = "SELECT id, kind, date, task_id, started_at, finished_at, skipped, step,
       snoozed_until
     FROM ritual_run";

fn from_row(row: &Row) -> rusqlite::Result<Ritual> {
    let steps: String = row.get(6)?;
    Ok(Ritual {
        kind: row.get(0)?,
        enabled: row.get(1)?,
        trigger: row.get(2)?,
        at_minute: row.get(3)?,
        weekdays: row.get(4)?,
        min_minutes: row.get(5)?,
        steps: steps
            .split(',')
            .filter(|step| !step.is_empty())
            .map(str::to_owned)
            .collect(),
    })
}

fn run_from_row(row: &Row) -> rusqlite::Result<RitualRun> {
    Ok(RitualRun {
        id: row.get(0)?,
        kind: row.get(1)?,
        date: row.get(2)?,
        task_id: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
        skipped: row.get(6)?,
        step: row.get(7)?,
        snoozed_until: row.get(8)?,
    })
}

pub fn get(conn: &Connection, kind: &str) -> Result<Ritual> {
    conn.query_row(
        &format!("{SELECT} WHERE kind = ?1"),
        params![kind],
        from_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Ritual"))
}

pub fn list(conn: &Connection) -> Result<Vec<Ritual>> {
    KINDS.iter().map(|kind| get(conn, kind)).collect()
}

pub fn update(conn: &Connection, kind: &str, input: &RitualInput) -> Result<Ritual> {
    let current = get(conn, kind)?;
    if !TRIGGERS.contains(&input.trigger.as_str()) {
        return Err(Error::invalid(format!(
            "Unknown trigger: {}",
            input.trigger
        )));
    }
    if (kind == "session") != (input.trigger == "after_timer_stop") && input.trigger != "manual" {
        return Err(Error::invalid("Only the session ritual follows the timer."));
    }
    if !(0..24 * 60).contains(&input.at_minute) {
        return Err(Error::invalid("Time must be within the day."));
    }
    if !(1..=127).contains(&input.weekdays) {
        return Err(Error::invalid("Pick at least one day."));
    }
    let steps = if kind == "weekly" {
        current.steps
    } else {
        if input.steps.is_empty() {
            return Err(Error::invalid("Keep at least one step."));
        }
        for step in &input.steps {
            if !STEPS.contains(&step.as_str()) {
                return Err(Error::invalid(format!("Unknown step: {step}")));
            }
        }
        let unique: std::collections::HashSet<_> = input.steps.iter().collect();
        if unique.len() != input.steps.len() {
            return Err(Error::invalid("Each step appears once."));
        }
        input.steps.clone()
    };
    conn.execute(
        "UPDATE ritual SET enabled = ?1, trigger = ?2, at_minute = ?3, weekdays = ?4, steps = ?5
         WHERE kind = ?6",
        params![
            input.enabled,
            input.trigger,
            input.at_minute,
            input.weekdays,
            steps.join(","),
            kind
        ],
    )?;
    get(conn, kind)
}

pub fn planning_time(conn: &Connection) -> Result<Option<String>> {
    read_setting(conn, PLANNING_SETTING)
}

pub fn set_planning_time(conn: &mut Connection, time: &str) -> Result<Vec<Ritual>> {
    if !matches!(time, "morning" | "evening") {
        return Err(Error::invalid("Plan in the morning or the evening."));
    }
    let tx = conn.transaction()?;
    write_setting(&tx, PLANNING_SETTING, time)?;
    tx.execute(
        "UPDATE ritual SET enabled = (kind = ?1) WHERE kind IN ('morning', 'evening')",
        params![time],
    )?;
    tx.commit()?;
    list(conn)
}

fn run(conn: &Connection, id: Id) -> Result<RitualRun> {
    conn.query_row(
        &format!("{SELECT_RUN} WHERE id = ?1"),
        params![id],
        run_from_row,
    )
    .optional()?
    .ok_or_else(|| Error::not_found("Ritual run"))
}

fn latest_run(conn: &Connection, kind: &str, date: Date) -> Result<Option<RitualRun>> {
    Ok(conn
        .query_row(
            &format!("{SELECT_RUN} WHERE kind = ?1 AND date = ?2 ORDER BY id DESC LIMIT 1"),
            params![kind, date],
            run_from_row,
        )
        .optional()?)
}

pub fn runs(conn: &Connection, from: Date, to: Date) -> Result<Vec<RitualRun>> {
    let mut stmt = conn.prepare(&format!(
        "{SELECT_RUN} WHERE date >= ?1 AND date < ?2 ORDER BY id"
    ))?;
    let rows = stmt.query_map(params![from, to], run_from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn on_weekday(ritual: &Ritual, date: Date) -> bool {
    ritual.weekdays & (1 << date.0.weekday().num_days_from_monday()) != 0
}

fn last_block_end(conn: &Connection, date: Date) -> Result<Option<Timestamp>> {
    Ok(conn.query_row(
        "SELECT MAX(end_at) FROM time_block WHERE start_at >= ?1 AND start_at < ?2",
        params![date.start(), date.add_days(1).start()],
        |row| row.get(0),
    )?)
}

fn last_week_reviewed(conn: &Connection, date: Date) -> Result<bool> {
    let last_monday = date.monday().add_days(-7);
    Ok(conn
        .query_row(
            "SELECT reviewed_at IS NOT NULL FROM week WHERE start_date = ?1",
            params![last_monday],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(false))
}

fn is_due(conn: &Connection, ritual: &Ritual, at: Moment, event: RitualEvent) -> Result<bool> {
    if !ritual.enabled || !on_weekday(ritual, at.date) {
        return Ok(false);
    }
    if ritual.trigger == "after_timer_stop" {
        return Ok(
            matches!(event, RitualEvent::TimerStopped { minutes } if minutes >= ritual.min_minutes),
        );
    }
    if matches!(event, RitualEvent::TimerStopped { .. }) {
        return Ok(false);
    }
    if let Some(previous) = latest_run(conn, &ritual.kind, at.date)? {
        let snooze_over = previous
            .snoozed_until
            .is_some_and(|until| until <= at.stamp);
        return Ok(previous.finished_at.is_none() && !previous.skipped && snooze_over);
    }
    if ritual.kind == "weekly" && last_week_reviewed(conn, at.date)? {
        return Ok(false);
    }
    Ok(match ritual.trigger.as_str() {
        "first_open" => true,
        "at_time" => at.minute >= ritual.at_minute,
        "end_of_day" => {
            at.minute >= ritual.at_minute
                || (at.minute >= ritual.at_minute - END_OF_DAY_EARLIEST_BEFORE
                    && last_block_end(conn, at.date)?.is_some_and(|end| end <= at.stamp))
        }
        _ => false,
    })
}

pub fn due(conn: &Connection, at: Moment, event: RitualEvent) -> Result<Option<Ritual>> {
    for ritual in list(conn)? {
        if is_due(conn, &ritual, at, event)? {
            return Ok(Some(ritual));
        }
    }
    Ok(None)
}

pub fn start(conn: &Connection, kind: &str, at: Moment, task_id: Option<Id>) -> Result<RitualRun> {
    get(conn, kind)?;
    if kind != "session"
        && let Some(previous) = latest_run(conn, kind, at.date)?
        && previous.finished_at.is_none()
    {
        conn.execute(
            "UPDATE ritual_run SET skipped = 0 WHERE id = ?1",
            params![previous.id],
        )?;
        return run(conn, previous.id);
    }
    conn.execute(
        "INSERT INTO ritual_run (kind, date, task_id, started_at) VALUES (?1, ?2, ?3, ?4)",
        params![kind, at.date, task_id, at.stamp],
    )?;
    run(conn, Id(conn.last_insert_rowid()))
}

pub fn reach_step(conn: &Connection, id: Id, step: i32) -> Result<RitualRun> {
    let rows = conn.execute(
        "UPDATE ritual_run SET step = MAX(step, ?1) WHERE id = ?2",
        params![step.max(0), id],
    )?;
    ensure_changed(rows, "Ritual run")?;
    run(conn, id)
}

pub fn finish(conn: &Connection, id: Id, at: Timestamp) -> Result<RitualRun> {
    let rows = conn.execute(
        "UPDATE ritual_run SET finished_at = COALESCE(finished_at, ?1) WHERE id = ?2",
        params![at, id],
    )?;
    ensure_changed(rows, "Ritual run")?;
    run(conn, id)
}

pub fn skip(conn: &Connection, id: Id) -> Result<RitualRun> {
    let rows = conn.execute(
        "UPDATE ritual_run SET skipped = 1 WHERE id = ?1 AND finished_at IS NULL",
        params![id],
    )?;
    ensure_changed(rows, "Ritual run")?;
    run(conn, id)
}

pub fn snooze(conn: &Connection, id: Id, at: Timestamp) -> Result<RitualRun> {
    let current = run(conn, id)?;
    if current.snoozed_until.is_some() {
        return Err(Error::invalid("This ritual was already snoozed once."));
    }
    conn.execute(
        "UPDATE ritual_run SET snoozed_until = ?1 WHERE id = ?2",
        params![Timestamp(at.0 + SNOOZE_SECONDS), id],
    )?;
    run(conn, id)
}

#[tauri::command]
#[specta::specta]
pub async fn list_rituals(db: State<'_, Db>) -> Result<Vec<Ritual>> {
    db.call(|conn| list(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn update_ritual(db: State<'_, Db>, kind: String, input: RitualInput) -> Result<Ritual> {
    db.call(|conn| update(conn, &kind, &input))
}

#[tauri::command]
#[specta::specta]
pub async fn get_planning_time(db: State<'_, Db>) -> Result<Option<String>> {
    db.call(|conn| planning_time(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn choose_planning_time(db: State<'_, Db>, time: String) -> Result<Vec<Ritual>> {
    db.call(|conn| set_planning_time(conn, &time))
}

#[tauri::command]
#[specta::specta]
pub async fn due_ritual(db: State<'_, Db>, event: RitualEvent) -> Result<Option<Ritual>> {
    db.call(|conn| due(conn, Moment::now(), event))
}

#[tauri::command]
#[specta::specta]
pub async fn list_ritual_runs(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<RitualRun>> {
    db.call(|conn| runs(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn start_ritual(
    db: State<'_, Db>,
    kind: String,
    task_id: Option<Id>,
) -> Result<RitualRun> {
    db.call(|conn| start(conn, &kind, Moment::now(), task_id))
}

#[tauri::command]
#[specta::specta]
pub async fn reach_ritual_step(db: State<'_, Db>, id: Id, step: i32) -> Result<RitualRun> {
    db.call(|conn| reach_step(conn, id, step))
}

#[tauri::command]
#[specta::specta]
pub async fn finish_ritual(db: State<'_, Db>, id: Id) -> Result<RitualRun> {
    db.call(|conn| finish(conn, id, Timestamp::now()))
}

#[tauri::command]
#[specta::specta]
pub async fn skip_ritual(db: State<'_, Db>, id: Id) -> Result<RitualRun> {
    db.call(|conn| skip(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn snooze_ritual(db: State<'_, Db>, id: Id) -> Result<RitualRun> {
    db.call(|conn| snooze(conn, id, Timestamp::now()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::date;

    fn moment(day: &str, minute: i32) -> Moment {
        let date = date(day);
        Moment {
            date,
            minute,
            stamp: Timestamp(date.start().0 + i64::from(minute) * 60),
        }
    }

    fn kind(ritual: Option<Ritual>) -> Option<String> {
        ritual.map(|ritual| ritual.kind)
    }

    #[test]
    fn seeds_five_templates() {
        let db = Db::in_memory();
        db.call(|conn| {
            let rituals = list(conn)?;
            assert_eq!(rituals.len(), 5);
            let session = get(conn, "session")?;
            assert!(session.enabled);
            assert_eq!(session.steps[0], "did_it_move");
            assert_eq!(
                get(conn, "evening")?.steps,
                ["what_moved", "leftovers", "habit_check", "one_line_note"]
            );
            assert_eq!(planning_time(conn)?, None);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn choosing_evening_turns_morning_off() {
        let db = Db::in_memory();
        db.call(|conn| {
            set_planning_time(conn, "morning")?;
            set_planning_time(conn, "evening")?;
            assert!(!get(conn, "morning")?.enabled);
            assert!(get(conn, "evening")?.enabled);
            assert_eq!(planning_time(conn)?.as_deref(), Some("evening"));
            assert!(set_planning_time(conn, "noon").is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn morning_runs_once_on_first_open() {
        let db = Db::in_memory();
        db.call(|conn| {
            conn.execute("UPDATE ritual SET enabled = 0 WHERE kind = 'weekly'", [])?;
            set_planning_time(conn, "morning")?;
            let at = moment("2026-11-03", 8 * 60);
            assert_eq!(
                kind(due(conn, at, RitualEvent::Open)?).as_deref(),
                Some("morning")
            );
            let started = start(conn, "morning", at, None)?;
            assert_eq!(kind(due(conn, at, RitualEvent::Tick)?), None);

            snooze(conn, started.id, at.stamp)?;
            assert!(snooze(conn, started.id, at.stamp).is_err());
            let later = moment("2026-11-03", 8 * 60 + 16);
            assert_eq!(
                kind(due(conn, later, RitualEvent::Tick)?).as_deref(),
                Some("morning")
            );
            skip(conn, started.id)?;
            assert_eq!(kind(due(conn, later, RitualEvent::Tick)?), None);
            assert_eq!(start(conn, "morning", later, None)?.id, started.id);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn evening_follows_the_clock_or_the_last_block() {
        let db = Db::in_memory();
        db.call(|conn| {
            conn.execute("UPDATE ritual SET enabled = 0 WHERE kind = 'weekly'", [])?;
            set_planning_time(conn, "evening")?;
            let day = "2026-11-03";
            assert_eq!(
                kind(due(conn, moment(day, 16 * 60), RitualEvent::Tick)?),
                None
            );
            conn.execute(
                "INSERT INTO task (title, created_at) VALUES ('Write', 0)",
                [],
            )?;
            let start_at = moment(day, 14 * 60).stamp;
            let end_at = moment(day, 15 * 60 + 30).stamp;
            conn.execute(
                "INSERT INTO time_block (task_id, start_at, end_at) VALUES (1, ?1, ?2)",
                params![start_at, end_at],
            )?;
            assert_eq!(
                kind(due(conn, moment(day, 16 * 60), RitualEvent::Tick)?).as_deref(),
                Some("evening")
            );
            assert_eq!(
                kind(due(
                    conn,
                    moment("2026-11-04", 17 * 60 + 30),
                    RitualEvent::Tick
                )?)
                .as_deref(),
                Some("evening")
            );
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn session_close_needs_a_long_enough_timer() {
        let db = Db::in_memory();
        db.call(|conn| {
            conn.execute("UPDATE ritual SET enabled = 0 WHERE kind = 'weekly'", [])?;
            let at = moment("2026-11-03", 10 * 60);
            assert_eq!(
                kind(due(conn, at, RitualEvent::TimerStopped { minutes: 12 })?),
                None
            );
            assert_eq!(
                kind(due(conn, at, RitualEvent::TimerStopped { minutes: 25 })?).as_deref(),
                Some("session")
            );
            let first = start(conn, "session", at, None)?;
            finish(conn, first.id, at.stamp)?;
            assert_ne!(start(conn, "session", at, None)?.id, first.id);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn weekly_waits_for_its_day_and_an_unreviewed_week() {
        let db = Db::in_memory();
        db.call(|conn| {
            let monday = moment("2026-11-02", 9 * 60);
            let tuesday = moment("2026-11-03", 9 * 60);
            assert_eq!(
                kind(due(conn, monday, RitualEvent::Open)?).as_deref(),
                Some("weekly")
            );
            assert_eq!(kind(due(conn, tuesday, RitualEvent::Open)?), None);
            conn.execute(
                "INSERT INTO week (start_date, reviewed_at) VALUES ('2026-10-26', 1)",
                [],
            )?;
            assert_eq!(kind(due(conn, monday, RitualEvent::Open)?), None);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn validates_steps_and_triggers() {
        let db = Db::in_memory();
        db.call(|conn| {
            let input = |trigger: &str, steps: &[&str]| RitualInput {
                enabled: true,
                trigger: trigger.into(),
                at_minute: 1050,
                weekdays: 127,
                steps: steps.iter().map(|step| (*step).to_owned()).collect(),
            };
            assert!(update(conn, "evening", &input("at_time", &["feel", "nope"])).is_err());
            assert!(update(conn, "evening", &input("at_time", &[])).is_err());
            assert!(update(conn, "evening", &input("after_timer_stop", &["feel"])).is_err());
            assert!(update(conn, "evening", &input("at_time", &["feel", "feel"])).is_err());
            let evening = update(
                conn,
                "evening",
                &input("at_time", &["one_line_note", "feel"]),
            )?;
            assert_eq!(evening.steps, ["one_line_note", "feel"]);
            let weekly = update(conn, "weekly", &input("first_open", &["feel"]))?;
            assert_eq!(weekly.steps, ["weekly_review"]);
            Ok(())
        })
        .unwrap();
    }
}
