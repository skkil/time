//! The tray icon (the menu bar on macOS): today at a glance from
//! `time_core::glance`, rebuilt every 30 s and after every write, with musts
//! to tick off, the timer and Quick Add. Closing the window can keep the app
//! in the tray, a device setting that starts off on Linux, where many
//! desktops show no tray at all.

use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread;
use std::time::Duration;

use chrono::{Local, TimeZone};
use rusqlite::Connection;
use serde_json::json;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, Window, Wry};
use time_core::glance::{self, Glance, GlanceItem, GlanceKind};
use time_core::time_entries::RunningTimer;
use time_core::types::{Date, Id, Timestamp};
use time_core::{Result, device_settings};

use crate::db::Db;
use crate::{capture, window};

const REFRESH_EVERY: Duration = Duration::from_secs(30);
const KEEP_SETTING: &str = "tray_on_close";
const KEEP_BY_DEFAULT: bool = cfg!(not(target_os = "linux"));
const OPEN_EARLIER_EVENT: &str = "open-earlier";
const TITLE_LIMIT: usize = 24;
const TRAY_ID: &str = "glance";

pub struct Refresh(Sender<()>);

impl Refresh {
    pub fn now(&self) {
        let _ = self.0.send(());
    }
}

pub fn keep_on_close(conn: &Connection) -> Result<bool> {
    Ok(
        match device_settings::read(conn, KEEP_SETTING)?.as_deref() {
            Some(value) => value == "on",
            None => KEEP_BY_DEFAULT,
        },
    )
}

pub fn set_keep_on_close(conn: &Connection, keep: bool) -> Result<()> {
    device_settings::set_switch(conn, KEEP_SETTING, keep)
}

fn clock(at: Timestamp) -> String {
    Local
        .timestamp_opt(at.0, 0)
        .earliest()
        .map(|moment| moment.format("%H:%M").to_string())
        .unwrap_or_default()
}

fn elapsed(timer: &RunningTimer, now: Timestamp) -> String {
    let seconds = match timer.paused_at {
        Some(_) => timer.banked_seconds,
        None => timer.banked_seconds + (now.0 - timer.started_at.0).max(0),
    };
    format!("{}:{:02}", seconds / 3600, seconds / 60 % 60)
}

fn timer_title(timer: &RunningTimer) -> &str {
    if timer.description.is_empty() {
        "Focus"
    } else {
        &timer.description
    }
}

fn describe(item: &GlanceItem) -> String {
    match (item.kind, item.ends_at) {
        (GlanceKind::Task, _) | (_, None) => format!("{} {}", clock(item.starts_at), item.title),
        (_, Some(end)) => format!("{}–{} {}", clock(item.starts_at), clock(end), item.title),
    }
}

fn shorten(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_owned();
    }
    let kept: String = text.chars().take(limit.saturating_sub(1)).collect();
    format!("{}…", kept.trim_end())
}

fn headline(glance: &Glance, now: Timestamp) -> String {
    if let Some(timer) = &glance.timer {
        let paused = if timer.paused_at.is_some() {
            " (break)"
        } else {
            ""
        };
        return format!("{} {}{paused}", elapsed(timer, now), timer_title(timer));
    }
    if let Some(item) = &glance.now {
        return format!("Now: {}", item.title);
    }
    match &glance.next {
        Some(item) => format!("{} {}", clock(item.starts_at), item.title),
        None => "Nothing planned now".to_owned(),
    }
}

fn menu(app: &AppHandle, glance: &Glance, now: Timestamp) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    let label = |text: String| MenuItem::new(app, shorten(&text, 60), false, None::<&str>);
    let action = |id: String, text: String| {
        MenuItem::with_id(app, id, shorten(&text, 60), true, None::<&str>)
    };

    menu.append(&label(match (&glance.timer, &glance.now) {
        (Some(timer), _) => format!("Now: {} · {}", timer_title(timer), elapsed(timer, now)),
        (None, Some(item)) => format!("Now: {}", describe(item)),
        (None, None) => "Nothing planned now".to_owned(),
    })?)?;
    if let Some(item) = &glance.next {
        menu.append(&label(format!("Next: {}", describe(item)))?)?;
    }
    if !glance.musts.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        menu.append(&label("Musts today".to_owned())?)?;
        for must in &glance.musts {
            menu.append(&action(
                format!("must:{}", must.id),
                format!("○ {}", must.title),
            )?)?;
        }
    }
    if glance.earlier_count > 0 {
        let count = glance.earlier_count;
        let noun = if count == 1 { "task" } else { "tasks" };
        menu.append(&action(
            "earlier".to_owned(),
            format!("From earlier days: {count} {noun}…"),
        )?)?;
    }
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    match (&glance.timer, &glance.now) {
        (Some(_), _) => menu.append(&action("timer:stop".to_owned(), "Stop timer".to_owned())?)?,
        (None, Some(item)) if item.kind == GlanceKind::Block => menu.append(&action(
            format!("timer:start:{}", item.task_id),
            format!("Start focus on {}", item.title),
        )?)?,
        _ => {}
    }
    menu.append(&action("quick-add".to_owned(), "Quick add…".to_owned())?)?;
    menu.append(&action("open".to_owned(), "Open skkil time".to_owned())?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&action("quit".to_owned(), "Quit".to_owned())?)?;
    Ok(menu)
}

fn render(app: &AppHandle, tray: &TrayIcon) -> Result<()> {
    let now = Timestamp::now();
    let glance = app
        .state::<Db>()
        .call(|conn| glance::today_glance(conn, now, Date::today()))?;
    let headline = shorten(&headline(&glance, now), TITLE_LIMIT);
    if let Ok(menu) = menu(app, &glance, now) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = tray.set_tooltip(Some(format!("skkil time · {headline}")));
    #[cfg(target_os = "macos")]
    let _ = tray.set_title(Some(headline));
    Ok(())
}

fn act(app: &AppHandle, id: &str) {
    let db = app.state::<Db>();
    let done = |_: Result<serde_json::Value>| app.state::<Refresh>().now();
    if let Some(task) = id.strip_prefix("must:") {
        done(db.mutate(
            "setTaskCompleted",
            &json!({ "id": task, "completed": true }),
        ));
    } else if let Some(task) = id.strip_prefix("timer:start:") {
        let title = Id::parse(task)
            .and_then(|id| db.call(|conn| time_core::tasks::get(conn, &id)))
            .map(|task| task.title)
            .unwrap_or_default();
        done(db.mutate(
            "startTimer",
            &json!({ "details": { "description": title, "projectId": null, "taskId": task } }),
        ));
    } else {
        match id {
            "timer:stop" => done(db.mutate("stopTimer", &json!({}))),
            "earlier" => {
                window::show_main(app);
                let _ = app.emit(OPEN_EARLIER_EVENT, ());
            }
            "quick-add" => capture::quick_add(app),
            "open" => window::show_main(app),
            "quit" => app.exit(0),
            _ => {}
        }
    }
}

/// Hides the window instead of closing it while the app lives in the tray.
pub fn close_to_tray(window: &Window) -> bool {
    let app = window.app_handle();
    let keep = app.tray_by_id(TRAY_ID).is_some()
        && app
            .state::<Db>()
            .call(|conn| keep_on_close(conn))
            .unwrap_or(KEEP_BY_DEFAULT);
    if keep {
        let _ = window.hide();
    }
    keep
}

pub fn start(app: &AppHandle) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("skkil time")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| act(app, event.id().as_ref()));
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    let tray = builder.build(app)?;
    let (sender, receiver) = mpsc::channel();
    app.manage(Refresh(sender.clone()));
    app.state::<Db>().on_write(move || {
        let _ = sender.send(());
    });
    let app = app.clone();
    thread::spawn(move || {
        loop {
            let _ = render(&app, &tray);
            match receiver.recv_timeout(REFRESH_EVERY) {
                Ok(()) | Err(RecvTimeoutError::Timeout) => while receiver.try_recv().is_ok() {},
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_keep_in_tray(db: tauri::State<'_, Db>) -> Result<bool> {
    db.call(|conn| keep_on_close(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_keep_in_tray(db: tauri::State<'_, Db>, keep: bool) -> Result<()> {
    db.call(|conn| set_keep_on_close(conn, keep))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timer(started_at: i64, paused_at: Option<i64>, banked: i64) -> RunningTimer {
        RunningTimer {
            description: "Write".into(),
            project_id: None,
            task_id: None,
            started_at: Timestamp(started_at),
            paused_at: paused_at.map(Timestamp),
            banked_seconds: banked,
        }
    }

    #[test]
    fn keeps_titles_short() {
        assert_eq!(shorten("Write", 24), "Write");
        let long = shorten("Finish the literature review chapter", TITLE_LIMIT);
        assert_eq!(long.chars().count(), TITLE_LIMIT);
        assert!(long.ends_with('…'));
    }

    #[test]
    fn counts_the_session_including_breaks() {
        assert_eq!(
            elapsed(&timer(1_000, None, 600), Timestamp(1_000 + 3_000)),
            "1:00"
        );
        assert_eq!(
            elapsed(&timer(1_000, Some(2_000), 1_500), Timestamp(9_000)),
            "0:25"
        );
    }

    #[test]
    fn leads_with_the_timer_then_now_then_next() {
        let mut glance = Glance {
            timer: None,
            now: None,
            next: None,
            musts: Vec::new(),
            earlier_count: 0,
        };
        assert_eq!(headline(&glance, Timestamp(0)), "Nothing planned now");
        glance.now = Some(GlanceItem {
            kind: GlanceKind::Block,
            title: "Read".into(),
            task_id: Id::parse("0190f0f0-0000-7000-8000-000000000001").unwrap(),
            starts_at: Timestamp(0),
            ends_at: Some(Timestamp(3_600)),
        });
        assert_eq!(headline(&glance, Timestamp(60)), "Now: Read");
        glance.timer = Some(timer(0, None, 0));
        assert_eq!(headline(&glance, Timestamp(120)), "0:02 Write");
    }
}
