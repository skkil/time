use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::{ensure_changed, optional_text, required_text};
use crate::db::Db;
use crate::error::{Error, Result};
use crate::types::{Date, Id, Seconds, Timestamp};

const MAX_OPEN_OUTCOMES: i64 = 3;
const MAX_PRIORITIES: i64 = 3;
const LAST_STEP: i32 = 6;
pub const WEEKS_PER_QUARTER: i64 = 13;

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Day {
    pub date: Date,
    pub felt: Option<i32>,
    pub note: String,
    pub skipped: bool,
}

#[derive(Debug, Serialize, Deserialize, Default, Type)]
#[serde(rename_all = "camelCase")]
pub struct WeekNotes {
    pub worked: String,
    pub fell_short: String,
    pub change: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum OutcomeStatus {
    Open,
    Achieved,
    Carried,
    Dropped,
}

impl OutcomeStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Open => "open",
            Self::Achieved => "achieved",
            Self::Carried => "carried",
            Self::Dropped => "dropped",
        }
    }

    fn parse(value: &str) -> rusqlite::Result<Self> {
        match value {
            "open" => Ok(Self::Open),
            "achieved" => Ok(Self::Achieved),
            "carried" => Ok(Self::Carried),
            "dropped" => Ok(Self::Dropped),
            other => Err(rusqlite::Error::InvalidColumnType(
                0,
                other.to_owned(),
                rusqlite::types::Type::Text,
            )),
        }
    }
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub id: Id,
    pub title: String,
    pub status: OutcomeStatus,
    pub priority_id: Option<Id>,
    pub carried_from: Option<Id>,
    pub tasks_total: i32,
    pub tasks_done: i32,
    pub tracked_seconds: Seconds,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Week {
    pub start_date: Date,
    pub felt: Option<i32>,
    pub step: i32,
    pub reviewed_at: Option<Timestamp>,
    pub notes: WeekNotes,
    pub outcomes: Vec<Outcome>,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WeekSummary {
    pub start_date: Date,
    pub felt: Option<i32>,
    pub step: i32,
    pub reviewed_at: Option<Timestamp>,
    pub outcomes_total: i32,
    pub outcomes_achieved: i32,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Priority {
    pub id: Id,
    pub title: String,
    pub note: String,
    pub achieved: i32,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Quarter {
    pub id: Id,
    pub label: String,
    pub start_date: Date,
    pub week_no: i32,
    pub priorities: Vec<Priority>,
}

fn check_felt(felt: i32) -> Result<()> {
    if !(1..=5).contains(&felt) {
        return Err(Error::invalid("Rate it from 1 to 5."));
    }
    Ok(())
}

fn check_past(date: Date) -> Result<()> {
    if date > Date::today() {
        return Err(Error::invalid("That day hasn't happened yet."));
    }
    Ok(())
}

pub fn days(conn: &Connection, from: Date, to: Date) -> Result<Vec<Day>> {
    let mut stmt = conn.prepare(
        "SELECT date, felt, reflection, skipped FROM day
         WHERE date >= ?1 AND date < ?2 ORDER BY date",
    )?;
    let rows = stmt.query_map(params![from, to], |row| {
        Ok(Day {
            date: row.get(0)?,
            felt: row.get(1)?,
            note: row.get(2)?,
            skipped: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn set_day_felt(conn: &Connection, date: Date, felt: i32) -> Result<()> {
    check_felt(felt)?;
    check_past(date)?;
    conn.execute(
        "INSERT INTO day (date, felt) VALUES (?1, ?2)
         ON CONFLICT(date) DO UPDATE SET felt = excluded.felt, skipped = 0",
        params![date, felt],
    )?;
    Ok(())
}

pub fn set_day_note(conn: &Connection, date: Date, note: &str) -> Result<()> {
    check_past(date)?;
    let note = optional_text(note, "Note", 280)?;
    conn.execute(
        "INSERT INTO day (date, reflection) VALUES (?1, ?2)
         ON CONFLICT(date) DO UPDATE SET reflection = excluded.reflection",
        params![date, note],
    )?;
    Ok(())
}

pub fn skip_day(conn: &Connection, date: Date) -> Result<()> {
    conn.execute(
        "INSERT INTO day (date, skipped) VALUES (?1, 1)
         ON CONFLICT(date) DO UPDATE SET skipped = 1",
        params![date],
    )?;
    Ok(())
}

fn outcomes(conn: &Connection, start: Date) -> Result<Vec<Outcome>> {
    let mut stmt = conn.prepare(
        "SELECT o.id, o.title, o.status, o.priority_id, o.carried_from,
                (SELECT COUNT(*) FROM task t WHERE t.outcome_id = o.id),
                (SELECT COUNT(*) FROM task t WHERE t.outcome_id = o.id AND t.completed_at IS NOT NULL),
                (SELECT COALESCE(SUM(e.ended_at - e.started_at), 0)
                   FROM time_entry e JOIN task t ON t.id = e.task_id
                  WHERE t.outcome_id = o.id AND e.started_at >= ?2 AND e.started_at < ?3)
           FROM outcome o WHERE o.week_start = ?1 ORDER BY o.id",
    )?;
    let rows = stmt.query_map(
        params![start, start.start(), start.add_days(7).start()],
        |row| {
            Ok(Outcome {
                id: row.get(0)?,
                title: row.get(1)?,
                status: OutcomeStatus::parse(&row.get::<_, String>(2)?)?,
                priority_id: row.get(3)?,
                carried_from: row.get(4)?,
                tasks_total: row.get(5)?,
                tasks_done: row.get(6)?,
                tracked_seconds: row.get(7)?,
            })
        },
    )?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn ensure_week(conn: &Connection, start: Date) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO week (start_date) VALUES (?1)",
        params![start],
    )?;
    Ok(())
}

pub fn week(conn: &Connection, date: Date) -> Result<Week> {
    let start = date.monday();
    let row = conn
        .query_row(
            "SELECT felt, step, reviewed_at, worked, fell_short, change
               FROM week WHERE start_date = ?1",
            params![start],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    WeekNotes {
                        worked: row.get(3)?,
                        fell_short: row.get(4)?,
                        change: row.get(5)?,
                    },
                ))
            },
        )
        .optional()?;
    let (felt, step, reviewed_at, notes) = row.unwrap_or((None, 0, None, WeekNotes::default()));
    Ok(Week {
        start_date: start,
        felt,
        step,
        reviewed_at,
        notes,
        outcomes: outcomes(conn, start)?,
    })
}

pub fn weeks(conn: &Connection, from: Date, to: Date) -> Result<Vec<WeekSummary>> {
    let mut stmt = conn.prepare(
        "SELECT w.start_date, w.felt, w.step, w.reviewed_at,
                (SELECT COUNT(*) FROM outcome o WHERE o.week_start = w.start_date),
                (SELECT COUNT(*) FROM outcome o WHERE o.week_start = w.start_date AND o.status = 'achieved')
           FROM week w WHERE w.start_date >= ?1 AND w.start_date < ?2 ORDER BY w.start_date DESC",
    )?;
    let rows = stmt.query_map(params![from.monday(), to], |row| {
        Ok(WeekSummary {
            start_date: row.get(0)?,
            felt: row.get(1)?,
            step: row.get(2)?,
            reviewed_at: row.get(3)?,
            outcomes_total: row.get(4)?,
            outcomes_achieved: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn save_notes(conn: &Connection, date: Date, notes: &WeekNotes) -> Result<()> {
    let text = |value: &str| optional_text(value, "Reflection", 2_000);
    conn.execute(
        "INSERT INTO week (start_date, worked, fell_short, change) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(start_date) DO UPDATE SET
           worked = excluded.worked, fell_short = excluded.fell_short, change = excluded.change",
        params![
            date.monday(),
            text(&notes.worked)?,
            text(&notes.fell_short)?,
            text(&notes.change)?
        ],
    )?;
    Ok(())
}

pub fn set_week_felt(conn: &Connection, date: Date, felt: i32) -> Result<()> {
    check_felt(felt)?;
    let start = date.monday();
    ensure_week(conn, start)?;
    conn.execute(
        "UPDATE week SET felt = ?1 WHERE start_date = ?2",
        params![felt, start],
    )?;
    Ok(())
}

pub fn set_week_step(conn: &Connection, date: Date, step: i32) -> Result<()> {
    if !(0..=LAST_STEP).contains(&step) {
        return Err(Error::invalid("That review step doesn't exist."));
    }
    let start = date.monday();
    ensure_week(conn, start)?;
    conn.execute(
        "UPDATE week SET step = MAX(step, ?1) WHERE start_date = ?2",
        params![step, start],
    )?;
    Ok(())
}

pub fn finish_week(conn: &Connection, date: Date) -> Result<()> {
    let start = date.monday();
    ensure_week(conn, start)?;
    conn.execute(
        "UPDATE week SET step = ?1, reviewed_at = COALESCE(reviewed_at, ?2) WHERE start_date = ?3",
        params![LAST_STEP, Timestamp::now(), start],
    )?;
    Ok(())
}

fn open_outcomes(conn: &Connection, start: Date, except: Option<Id>) -> Result<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM outcome
         WHERE week_start = ?1 AND status = 'open' AND id IS NOT ?2",
        params![start, except],
        |row| row.get(0),
    )?)
}

fn insert_outcome(
    conn: &Connection,
    start: Date,
    title: &str,
    priority_id: Option<Id>,
    carried_from: Option<Id>,
) -> Result<Id> {
    if open_outcomes(conn, start, None)? >= MAX_OPEN_OUTCOMES {
        return Err(Error::invalid("3 outcomes max. Finish or drop one first."));
    }
    ensure_week(conn, start)?;
    conn.execute(
        "INSERT INTO outcome (week_start, title, priority_id, carried_from) VALUES (?1, ?2, ?3, ?4)",
        params![start, title, priority_id, carried_from],
    )?;
    Ok(Id(conn.last_insert_rowid()))
}

pub fn add_outcome(
    conn: &Connection,
    date: Date,
    title: &str,
    priority_id: Option<Id>,
) -> Result<()> {
    let title = required_text(title, "Outcome", 200)?;
    insert_outcome(conn, date.monday(), &title, priority_id, None)?;
    Ok(())
}

pub fn rename_outcome(
    conn: &Connection,
    id: Id,
    title: &str,
    priority_id: Option<Id>,
) -> Result<()> {
    let title = required_text(title, "Outcome", 200)?;
    let rows = conn.execute(
        "UPDATE outcome SET title = ?1, priority_id = ?2 WHERE id = ?3",
        params![title, priority_id, id],
    )?;
    ensure_changed(rows, "Outcome")
}

fn carry(conn: &Connection, id: Id, start: Date) -> Result<()> {
    let (title, priority_id): (String, Option<Id>) = conn.query_row(
        "SELECT title, priority_id FROM outcome WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let next = insert_outcome(conn, start.add_days(7), &title, priority_id, Some(id))?;
    conn.execute(
        "UPDATE task SET outcome_id = ?1 WHERE outcome_id = ?2 AND completed_at IS NULL",
        params![next, id],
    )?;
    Ok(())
}

fn uncarry(conn: &Connection, id: Id) -> Result<()> {
    let next: Option<Id> = conn
        .query_row(
            "SELECT id FROM outcome WHERE carried_from = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(next) = next {
        conn.execute(
            "UPDATE task SET outcome_id = ?1 WHERE outcome_id = ?2",
            params![id, next],
        )?;
        conn.execute("DELETE FROM outcome WHERE id = ?1", params![next])?;
    }
    Ok(())
}

pub fn set_outcome_status(conn: &mut Connection, id: Id, status: OutcomeStatus) -> Result<()> {
    let tx = conn.transaction()?;
    let (start, current): (Date, String) = tx
        .query_row(
            "SELECT week_start, status FROM outcome WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| Error::not_found("Outcome"))?;
    let current = OutcomeStatus::parse(&current)?;
    if current == status {
        return Ok(());
    }
    if status == OutcomeStatus::Open && open_outcomes(&tx, start, Some(id))? >= MAX_OPEN_OUTCOMES {
        return Err(Error::invalid("3 outcomes max. Finish or drop one first."));
    }
    if current == OutcomeStatus::Carried {
        uncarry(&tx, id)?;
    }
    if status == OutcomeStatus::Carried {
        carry(&tx, id, start)?;
    }
    tx.execute(
        "UPDATE outcome SET status = ?1 WHERE id = ?2",
        params![status.as_str(), id],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn delete_outcome(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM outcome WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Outcome")
}

pub fn quarter_for(conn: &Connection, date: Date) -> Result<Option<Quarter>> {
    let monday = date.monday();
    let found: Option<(Id, String, Date)> = conn
        .query_row(
            "SELECT id, label, start_date FROM quarter
             WHERE start_date <= ?1 ORDER BY start_date DESC LIMIT 1",
            params![monday],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;
    let Some((id, label, start_date)) = found else {
        return Ok(None);
    };
    let week_no = monday.days_since(start_date) / 7 + 1;
    if week_no > WEEKS_PER_QUARTER {
        return Ok(None);
    }

    let mut stmt = conn.prepare(
        "SELECT p.id, p.title, p.note,
                (SELECT COUNT(*) FROM outcome o
                  WHERE o.priority_id = p.id AND o.status = 'achieved'
                    AND o.week_start >= ?2 AND o.week_start < ?3)
           FROM priority p WHERE p.quarter_id = ?1 ORDER BY p.id",
    )?;
    let priorities = stmt
        .query_map(
            params![id, start_date, start_date.add_days(WEEKS_PER_QUARTER * 7)],
            |row| {
                Ok(Priority {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    note: row.get(2)?,
                    achieved: row.get(3)?,
                })
            },
        )?
        .collect::<rusqlite::Result<_>>()?;

    Ok(Some(Quarter {
        id,
        label,
        start_date,
        week_no: week_no as i32,
        priorities,
    }))
}

pub fn save_quarter(conn: &Connection, id: Option<Id>, label: &str, start: Date) -> Result<Id> {
    let label = required_text(label, "Quarter name", 40)?;
    let start = start.monday();
    match id {
        Some(id) => {
            let rows = conn.execute(
                "UPDATE quarter SET label = ?1, start_date = ?2 WHERE id = ?3",
                params![label, start, id],
            )?;
            ensure_changed(rows, "Quarter")?;
            Ok(id)
        }
        None => {
            conn.execute(
                "INSERT INTO quarter (label, start_date) VALUES (?1, ?2)",
                params![label, start],
            )?;
            Ok(Id(conn.last_insert_rowid()))
        }
    }
}

pub fn add_priority(conn: &Connection, quarter_id: Id, title: &str) -> Result<()> {
    let title = required_text(title, "Priority", 200)?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM priority WHERE quarter_id = ?1",
        params![quarter_id],
        |row| row.get(0),
    )?;
    if count >= MAX_PRIORITIES {
        return Err(Error::invalid("3 priorities max. Remove one first."));
    }
    conn.execute(
        "INSERT INTO priority (quarter_id, title) VALUES (?1, ?2)",
        params![quarter_id, title],
    )?;
    Ok(())
}

pub fn edit_priority(conn: &Connection, id: Id, title: &str, note: &str) -> Result<()> {
    let title = required_text(title, "Priority", 200)?;
    let note = optional_text(note, "Note", 2_000)?;
    let rows = conn.execute(
        "UPDATE priority SET title = ?1, note = ?2 WHERE id = ?3",
        params![title, note, id],
    )?;
    ensure_changed(rows, "Priority")
}

pub fn delete_priority(conn: &Connection, id: Id) -> Result<()> {
    let rows = conn.execute("DELETE FROM priority WHERE id = ?1", params![id])?;
    ensure_changed(rows, "Priority")
}

#[tauri::command]
#[specta::specta]
pub async fn list_days(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<Day>> {
    db.call(|conn| days(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn rate_day(db: State<'_, Db>, date: Date, felt: i32) -> Result<()> {
    db.call(|conn| set_day_felt(conn, date, felt))
}

#[tauri::command]
#[specta::specta]
pub async fn save_day_note(db: State<'_, Db>, date: Date, note: String) -> Result<()> {
    db.call(|conn| set_day_note(conn, date, &note))
}

#[tauri::command]
#[specta::specta]
pub async fn skip_day_check_in(db: State<'_, Db>, date: Date) -> Result<()> {
    db.call(|conn| skip_day(conn, date))
}

#[tauri::command]
#[specta::specta]
pub async fn get_week(db: State<'_, Db>, date: Date) -> Result<Week> {
    db.call(|conn| week(conn, date))
}

#[tauri::command]
#[specta::specta]
pub async fn list_weeks(db: State<'_, Db>, from: Date, to: Date) -> Result<Vec<WeekSummary>> {
    db.call(|conn| weeks(conn, from, to))
}

#[tauri::command]
#[specta::specta]
pub async fn save_week_notes(db: State<'_, Db>, date: Date, notes: WeekNotes) -> Result<()> {
    db.call(|conn| save_notes(conn, date, &notes))
}

#[tauri::command]
#[specta::specta]
pub async fn rate_week(db: State<'_, Db>, date: Date, felt: i32) -> Result<()> {
    db.call(|conn| set_week_felt(conn, date, felt))
}

#[tauri::command]
#[specta::specta]
pub async fn reach_review_step(db: State<'_, Db>, date: Date, step: i32) -> Result<()> {
    db.call(|conn| set_week_step(conn, date, step))
}

#[tauri::command]
#[specta::specta]
pub async fn finish_week_review(db: State<'_, Db>, date: Date) -> Result<()> {
    db.call(|conn| finish_week(conn, date))
}

#[tauri::command]
#[specta::specta]
pub async fn create_outcome(
    db: State<'_, Db>,
    date: Date,
    title: String,
    priority_id: Option<Id>,
) -> Result<()> {
    db.call(|conn| add_outcome(conn, date, &title, priority_id))
}

#[tauri::command]
#[specta::specta]
pub async fn update_outcome(
    db: State<'_, Db>,
    id: Id,
    title: String,
    priority_id: Option<Id>,
) -> Result<()> {
    db.call(|conn| rename_outcome(conn, id, &title, priority_id))
}

#[tauri::command]
#[specta::specta]
pub async fn update_outcome_status(db: State<'_, Db>, id: Id, status: OutcomeStatus) -> Result<()> {
    db.call(|conn| set_outcome_status(conn, id, status))
}

#[tauri::command]
#[specta::specta]
pub async fn remove_outcome(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete_outcome(conn, id))
}

#[tauri::command]
#[specta::specta]
pub async fn get_quarter(db: State<'_, Db>, date: Date) -> Result<Option<Quarter>> {
    db.call(|conn| quarter_for(conn, date))
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_quarter(
    db: State<'_, Db>,
    id: Option<Id>,
    label: String,
    start_date: Date,
) -> Result<Id> {
    db.call(|conn| save_quarter(conn, id, &label, start_date))
}

#[tauri::command]
#[specta::specta]
pub async fn create_priority(db: State<'_, Db>, quarter_id: Id, title: String) -> Result<()> {
    db.call(|conn| add_priority(conn, quarter_id, &title))
}

#[tauri::command]
#[specta::specta]
pub async fn update_priority(db: State<'_, Db>, id: Id, title: String, note: String) -> Result<()> {
    db.call(|conn| edit_priority(conn, id, &title, &note))
}

#[tauri::command]
#[specta::specta]
pub async fn remove_priority(db: State<'_, Db>, id: Id) -> Result<()> {
    db.call(|conn| delete_priority(conn, id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::tasks;
    use crate::types::date;

    #[test]
    fn numbers_weeks_inside_the_quarter() {
        let db = Db::in_memory();
        db.call(|conn| {
            save_quarter(conn, None, "2026 Q4", date("2026-09-30"))?;
            let week = |d: &str| quarter_for(conn, date(d)).map(|q| q.map(|q| q.week_no));
            assert_eq!(week("2026-09-28")?, Some(1));
            assert_eq!(week("2026-11-01")?, Some(5));
            assert_eq!(week("2026-12-27")?, Some(13));
            assert_eq!(week("2026-12-28")?, None);
            assert_eq!(week("2026-09-27")?, None);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn caps_open_outcomes_at_three() {
        let db = Db::in_memory();
        db.call(|conn| {
            let monday = date("2026-11-02");
            for title in ["A", "B", "C"] {
                add_outcome(conn, monday, title, None)?;
            }
            assert!(add_outcome(conn, monday.add_days(3), "D", None).is_err());

            let first = week(conn, monday)?.outcomes[0].id;
            set_outcome_status(conn, first, OutcomeStatus::Achieved)?;
            add_outcome(conn, monday, "D", None)?;
            assert!(set_outcome_status(conn, first, OutcomeStatus::Open).is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn carrying_moves_open_tasks_and_undoing_moves_them_back() {
        let db = Db::in_memory();
        db.call(|conn| {
            let monday = date("2026-11-02");
            add_outcome(conn, monday, "Ship beta", None)?;
            let outcome = week(conn, monday)?.outcomes[0].id;
            let done = tasks::create(conn, &tasks::input("Write docs", None))?;
            let open = tasks::create(conn, &tasks::input("Fix login", None))?;
            tasks::set_outcome(conn, done.id, Some(outcome))?;
            tasks::set_outcome(conn, open.id, Some(outcome))?;
            tasks::set_completed(conn, done.id, true)?;

            let evidence = &week(conn, monday)?.outcomes[0];
            assert_eq!((evidence.tasks_done, evidence.tasks_total), (1, 2));

            set_outcome_status(conn, outcome, OutcomeStatus::Carried)?;
            let next = &week(conn, monday.add_days(7))?.outcomes[0];
            assert_eq!(next.carried_from, Some(outcome));
            assert_eq!(tasks::get(conn, open.id)?.outcome_id, Some(next.id));
            assert_eq!(tasks::get(conn, done.id)?.outcome_id, Some(outcome));

            set_outcome_status(conn, outcome, OutcomeStatus::Achieved)?;
            assert!(week(conn, monday.add_days(7))?.outcomes.is_empty());
            assert_eq!(tasks::get(conn, open.id)?.outcome_id, Some(outcome));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn tracks_week_review_progress() {
        let db = Db::in_memory();
        db.call(|conn| {
            let monday = date("2026-11-02");
            set_week_felt(conn, monday, 3)?;
            set_week_step(conn, monday, 2)?;
            set_week_step(conn, monday, 1)?;
            assert_eq!(week(conn, monday)?.step, 2);
            assert!(week(conn, monday)?.reviewed_at.is_none());
            finish_week(conn, monday.add_days(2))?;
            let summary = &weeks(conn, monday, monday.add_days(7))?[0];
            assert_eq!(summary.felt, Some(3));
            assert!(summary.reviewed_at.is_some());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rates_past_days_only() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = Date::today();
            skip_day(conn, today)?;
            set_day_felt(conn, today, 4)?;
            set_day_note(conn, today, "steady")?;
            assert!(set_day_felt(conn, today.add_days(1), 4).is_err());
            assert!(set_day_felt(conn, today, 6).is_err());
            let day = &days(conn, today, today.add_days(1))?[0];
            assert_eq!(
                (day.felt, day.note.as_str(), day.skipped),
                (Some(4), "steady", false)
            );
            Ok(())
        })
        .unwrap();
    }
}
