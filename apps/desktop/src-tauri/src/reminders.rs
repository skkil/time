//! The reminder thread: every 20 s it asks time-core what became due since the
//! last check (timed tasks, focus blocks, events ahead of time) for the kinds
//! this device shows, and shows a notification for each. After a restart it
//! catches up on the last ten minutes. Only Linux reports the click.

use std::thread;
use std::time::Duration;

use crate::db::Db;
use chrono::{Local, TimeZone};
use tauri::{AppHandle, Emitter, Manager};
use time_core::device_settings;
use time_core::reminders::{self, Reminder, ReminderKind};
use time_core::types::{Id, Timestamp};

use crate::window;

const CHECK_EVERY: Duration = Duration::from_secs(20);
const CATCH_UP: Duration = Duration::from_secs(10 * 60);
const CHECKED_SETTING: &str = "reminders_checked_until";
const OPEN_TASK_EVENT: &str = "open-task";

fn open_task(app: &AppHandle, task_id: Id) {
    window::show_main(app);
    let _ = app.emit(OPEN_TASK_EVENT, task_id);
}

fn notify(app: &AppHandle, reminder: Reminder) {
    let app = app.clone();
    thread::spawn(move || {
        let body = body(&reminder);
        let mut notification = notify_rust::Notification::new();
        notification
            .appname("skkil time")
            .summary(&reminder.title)
            .body(&body);
        #[cfg(target_os = "linux")]
        if let Ok(handle) = notification.action("default", "Open").show() {
            handle.wait_for_action(|action| {
                if action == "default" {
                    open_task(&app, reminder.task_id.clone());
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

fn clock(at: Timestamp) -> String {
    Local
        .timestamp_opt(at.0, 0)
        .earliest()
        .map(|moment| moment.format("%H:%M").to_string())
        .unwrap_or_default()
}

fn body(reminder: &Reminder) -> String {
    match reminder.kind {
        ReminderKind::Task => clock(reminder.starts_at),
        ReminderKind::Block => format!("Focus block at {}", clock(reminder.starts_at)),
        ReminderKind::Event if reminder.location.is_empty() => {
            format!("Starts at {}", clock(reminder.starts_at))
        }
        ReminderKind::Event => format!(
            "Starts at {} · {}",
            clock(reminder.starts_at),
            reminder.location
        ),
    }
}

fn check(app: &AppHandle, since: Timestamp, now: Timestamp) -> time_core::Result<()> {
    let db = app.state::<Db>();
    let due = db.call(|conn| {
        let prefs = reminders::device_prefs(conn)?;
        let due = reminders::upcoming(conn, since, now, &prefs)?;
        device_settings::write(conn, CHECKED_SETTING, &now.0.to_string())?;
        Ok(due)
    })?;
    for reminder in due {
        notify(app, reminder);
    }
    Ok(())
}

/// Where checking resumes after a start: from the last check when that was
/// recent, so reminders due while the app was closed still fire, once.
fn resume_from(checked: Option<i64>, now: Timestamp) -> Timestamp {
    let earliest = now.0 - CATCH_UP.as_secs() as i64;
    let fresh = now.0 - CHECK_EVERY.as_secs() as i64;
    Timestamp(checked.map_or(fresh, |checked| checked.clamp(earliest, now.0)))
}

pub fn start(app: AppHandle) {
    thread::spawn(move || {
        let checked = app
            .state::<Db>()
            .call(|conn| device_settings::read(conn, CHECKED_SETTING))
            .ok()
            .flatten()
            .and_then(|value| value.parse().ok());
        let mut since = resume_from(checked, Timestamp::now());
        loop {
            let now = Timestamp::now();
            if check(&app, since, now).is_ok() {
                since = now;
            }
            thread::sleep(CHECK_EVERY);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catches_up_on_a_short_absence_and_not_a_long_one() {
        let now = Timestamp(100_000);
        assert_eq!(resume_from(None, now), Timestamp(100_000 - 20));
        assert_eq!(resume_from(Some(99_700), now), Timestamp(99_700));
        assert_eq!(resume_from(Some(10_000), now), Timestamp(100_000 - 600));
        assert_eq!(resume_from(Some(200_000), now), now);
    }
}
