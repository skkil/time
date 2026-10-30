//! The reminder thread: every 20 s it asks time-core which timed tasks are
//! due and shows a notification for each. Only Linux reports the click.

use std::thread;
use std::time::Duration;

use crate::db::Db;
use chrono::{Local, Timelike};
use tauri::{AppHandle, Emitter, Manager};
use time_core::reminders::{self, Reminder};
use time_core::types::{Date, Id};

use crate::window;

const CHECK_EVERY: Duration = Duration::from_secs(20);
const OPEN_TASK_EVENT: &str = "open-task";

fn open_task(app: &AppHandle, task_id: Id) {
    window::show_main(app);
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

fn check(app: &AppHandle) -> time_core::Result<()> {
    let db = app.state::<Db>();
    let now = Local::now();
    let minute = (now.hour() * 60 + now.minute()) as i32;
    let due = db.call(|conn| {
        if reminders::enabled(conn)? {
            reminders::take_due(conn, Date::today(), minute)
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
