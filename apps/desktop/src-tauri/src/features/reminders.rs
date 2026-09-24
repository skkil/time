use std::thread;
use std::time::Duration;

use chrono::{Local, Timelike};
use rusqlite::{Connection, params};
use tauri::{AppHandle, Emitter, Manager, State};

use super::{read_setting, show_main_window, write_setting};
use crate::db::Db;
use crate::error::Result;
use crate::types::{Date, Id};

const ENABLED_SETTING: &str = "reminders_enabled";
const GRACE_MINUTES: i32 = 10;
const CHECK_EVERY: Duration = Duration::from_secs(20);
const OPEN_TASK_EVENT: &str = "open-task";

#[derive(Debug, PartialEq)]
pub struct Reminder {
    pub task_id: Id,
    pub title: String,
    pub minute: i32,
}

pub fn enabled(conn: &Connection) -> Result<bool> {
    Ok(read_setting(conn, ENABLED_SETTING)?.as_deref() != Some("off"))
}

pub fn set_enabled(conn: &Connection, enabled: bool) -> Result<()> {
    write_setting(conn, ENABLED_SETTING, if enabled { "on" } else { "off" })
}

pub fn take_due(conn: &mut Connection, today: Date, minute: i32) -> Result<Vec<Reminder>> {
    let tx = conn.transaction()?;
    let due = {
        let mut stmt = tx.prepare(
            "SELECT id, title, due_time FROM task
             WHERE due_date = ?1
               AND due_time BETWEEN ?2 AND ?3
               AND completed_at IS NULL
               AND someday = 0
               AND reminded_for IS NOT (due_date || ' ' || due_time)",
        )?;
        stmt.query_map(params![today, minute - GRACE_MINUTES, minute], |row| {
            Ok(Reminder {
                task_id: row.get(0)?,
                title: row.get(1)?,
                minute: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?
    };
    for reminder in &due {
        tx.execute(
            "UPDATE task SET reminded_for = due_date || ' ' || due_time WHERE id = ?1",
            params![reminder.task_id],
        )?;
    }
    tx.commit()?;
    Ok(due)
}

fn open_task(app: &AppHandle, task_id: Id) {
    show_main_window(app);
    let _ = app.emit(OPEN_TASK_EVENT, task_id);
}

fn notify(app: &AppHandle, reminder: Reminder) {
    let app = app.clone();
    thread::spawn(move || {
        let body = format!("{:02}:{:02}", reminder.minute / 60, reminder.minute % 60);
        let mut notification = notify_rust::Notification::new();
        notification
            .appname("skkil time")
            .summary(&reminder.title)
            .body(&body);
        #[cfg(target_os = "linux")]
        if let Ok(handle) = notification.action("default", "Open").show() {
            handle.wait_for_action(|action| {
                if action == "default" {
                    open_task(&app, reminder.task_id);
                }
            });
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = notification.show();
            let _ = &app;
        }
    });
}

fn check(app: &AppHandle) -> Result<()> {
    let db = app.state::<Db>();
    let now = Local::now();
    let minute = (now.hour() * 60 + now.minute()) as i32;
    let due = db.call(|conn| {
        if enabled(conn)? {
            take_due(conn, Date::today(), minute)
        } else {
            Ok(Vec::new())
        }
    })?;
    for reminder in due {
        notify(app, reminder);
    }
    Ok(())
}

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        loop {
            let _ = check(&app);
            thread::sleep(CHECK_EVERY);
        }
    });
}

#[tauri::command]
#[specta::specta]
pub async fn get_reminders_enabled(db: State<'_, Db>) -> Result<bool> {
    db.call(|conn| enabled(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_reminders_enabled(db: State<'_, Db>, enabled: bool) -> Result<()> {
    db.call(|conn| set_enabled(conn, enabled))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::tasks;
    use crate::types::date;

    fn timed(conn: &mut Connection, title: &str, day: &str, minute: i32) -> Result<Id> {
        let mut input = tasks::input(title, None);
        input.due_date = Some(date(day));
        input.due_time = Some(minute);
        Ok(tasks::create(conn, &input)?.id)
    }

    #[test]
    fn fires_once_at_the_due_time() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = date("2026-11-07");
            let id = timed(conn, "Call dentist", "2026-11-07", 20 * 60)?;

            assert!(take_due(conn, today, 20 * 60 - 1)?.is_empty());
            let fired = take_due(conn, today, 20 * 60)?;
            assert_eq!(fired.len(), 1);
            assert_eq!(fired[0].task_id, id);
            assert!(take_due(conn, today, 20 * 60 + 1)?.is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn skips_old_finished_and_other_days() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = date("2026-11-07");
            timed(conn, "Long gone", "2026-11-07", 8 * 60)?;
            timed(conn, "Tomorrow", "2026-11-08", 12 * 60)?;
            let done = timed(conn, "Done", "2026-11-07", 12 * 60)?;
            tasks::set_completed(conn, done, true)?;

            assert!(take_due(conn, today, 12 * 60)?.is_empty());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn fires_again_after_a_reschedule() {
        let db = Db::in_memory();
        db.call(|conn| {
            let today = date("2026-11-07");
            let id = timed(conn, "Call", "2026-11-07", 9 * 60)?;
            assert_eq!(take_due(conn, today, 9 * 60)?.len(), 1);

            conn.execute(
                "UPDATE task SET due_time = ?1 WHERE id = ?2",
                params![10 * 60, id],
            )?;

            assert_eq!(take_due(conn, today, 10 * 60)?.len(), 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn stays_on_until_turned_off() {
        let db = Db::in_memory();
        db.call(|conn| {
            assert!(enabled(conn)?);
            set_enabled(conn, false)?;
            assert!(!enabled(conn)?);
            Ok(())
        })
        .unwrap();
    }
}
