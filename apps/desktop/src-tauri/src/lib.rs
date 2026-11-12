mod activitywatch;
mod backup;
mod capture;
mod commands;
mod db;
pub mod mcp;
mod reminders;
mod sync;
mod tray;
mod window;

use std::sync::Arc;

use tauri::{Manager, WindowEvent};
use tauri_specta::{Builder, ErrorHandlingMode, collect_commands};

use commands::{
    blocks, calendar, canvas, data, dependencies, glance, groups, habits, import, projects,
    records, review, rituals, sections, tasks, time_entries, undo, workflow,
};

#[cfg(any(debug_assertions, test))]
const BINDINGS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../shared/client/src/types/bindings.ts"
);
#[cfg(any(debug_assertions, test))]
const PLATFORM_BINDINGS_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts");

/// Commands only the desktop shell calls, behind `Platform.sync`: kept out
/// of the shared contract and exported to `apps/desktop/src/bindings.ts`.
fn platform_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .error_handling(ErrorHandlingMode::Throw)
        .disable_serde_phases()
        .typ::<sync::view::RemoteChange>()
        .commands(collect_commands![
            sync::commands::sync_status,
            sync::commands::sync_now,
            sync::commands::sync_issues,
            sync::commands::dismiss_sync_issue,
            sync::commands::retry_sync_issue,
            sync::commands::sign_in,
            sync::commands::choose_account_data,
            sync::commands::sign_out,
            sync::commands::get_sync_config,
            sync::commands::set_sync_config,
            sync::commands::calendar_status,
            sync::commands::connect_calendar,
            sync::commands::disconnect_calendar,
            tray::get_keep_in_tray,
            tray::set_keep_in_tray,
        ])
}

const PLATFORM_COMMANDS: [&str; 15] = [
    "sync_status",
    "sync_now",
    "sync_issues",
    "dismiss_sync_issue",
    "retry_sync_issue",
    "sign_in",
    "choose_account_data",
    "sign_out",
    "get_sync_config",
    "set_sync_config",
    "calendar_status",
    "connect_calendar",
    "disconnect_calendar",
    "get_keep_in_tray",
    "set_keep_in_tray",
];

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .error_handling(ErrorHandlingMode::Throw)
        .disable_serde_phases()
        .commands(collect_commands![
            projects::list_projects,
            projects::create_project,
            projects::update_project,
            projects::set_project_archived,
            projects::set_project_view,
            projects::update_project_settings,
            projects::mark_project_reviewed,
            projects::reorder_project,
            projects::delete_project,
            dependencies::add_task_dependency,
            dependencies::remove_task_dependency,
            groups::list_groups,
            groups::create_group,
            groups::rename_group,
            groups::delete_group,
            canvas::get_project_canvas,
            canvas::save_project_canvas,
            tasks::list_tasks,
            tasks::get_task,
            tasks::create_task,
            tasks::update_task,
            tasks::move_task,
            tasks::reschedule_tasks,
            tasks::move_tasks,
            tasks::set_task_completed,
            tasks::set_task_outcome,
            tasks::set_tasks_someday,
            tasks::set_task_must,
            tasks::set_task_next_step,
            tasks::delete_tasks,
            tasks::delete_task,
            undo::capture_tasks,
            undo::restore_tasks,
            sections::list_sections,
            sections::create_section,
            sections::rename_section,
            sections::set_section_collapsed,
            sections::reorder_section,
            sections::delete_section,
            blocks::list_blocks,
            blocks::create_block,
            blocks::reschedule_block,
            blocks::delete_block,
            blocks::count_ended_blocks,
            blocks::log_ended_blocks,
            blocks::get_auto_log_blocks,
            blocks::set_auto_log_blocks,
            calendar::list_calendar_sources,
            calendar::list_calendar_events,
            calendar::set_calendar_source_visible,
            time_entries::list_time_entries,
            time_entries::list_task_entries,
            time_entries::list_project_entries,
            time_entries::create_time_entry,
            time_entries::update_time_entry,
            time_entries::delete_time_entry,
            time_entries::get_timer,
            glance::today_glance,
            time_entries::start_timer,
            time_entries::edit_timer,
            time_entries::stop_timer,
            time_entries::pause_timer,
            time_entries::resume_timer,
            time_entries::discard_timer,
            time_entries::restore_timer,
            habits::list_habits,
            habits::create_habit,
            habits::update_habit,
            habits::archive_habit,
            habits::list_habit_days,
            habits::set_habit_status,
            habits::add_habit_value,
            habits::record_habit_measurements,
            habits::sync_habits,
            review::list_days,
            review::rate_day,
            review::save_day_note,
            review::skip_day_check_in,
            review::get_week,
            review::list_weeks,
            review::save_week_notes,
            review::rate_week,
            review::reach_review_step,
            review::finish_week_review,
            review::create_outcome,
            review::update_outcome,
            review::update_outcome_status,
            review::remove_outcome,
            review::get_quarter,
            review::upsert_quarter,
            review::create_priority,
            review::update_priority,
            review::remove_priority,
            rituals::list_rituals,
            rituals::update_ritual,
            rituals::get_planning_time,
            rituals::choose_planning_time,
            rituals::due_ritual,
            rituals::get_review_day,
            rituals::set_review_day,
            rituals::week_to_close,
            rituals::list_ritual_runs,
            rituals::start_ritual,
            rituals::reach_ritual_step,
            rituals::finish_ritual,
            rituals::skip_ritual,
            rituals::snooze_ritual,
            workflow::get_workflow,
            workflow::list_presets,
            workflow::create_item_type,
            workflow::update_item_type,
            workflow::delete_item_type,
            workflow::create_item_status,
            workflow::update_item_status,
            workflow::reorder_item_status,
            workflow::delete_item_status,
            workflow::create_project_milestone,
            workflow::update_project_milestone,
            workflow::delete_project_milestone,
            workflow::set_project_milestone_label,
            workflow::create_saved_view,
            workflow::update_saved_view,
            workflow::delete_saved_view,
            workflow::apply_project_preset,
            workflow::save_project_preset,
            workflow::read_preset,
            workflow::set_task_type_id,
            workflow::set_task_status_id,
            workflow::set_task_milestone_id,
            workflow::set_task_event_details,
            workflow::list_events,
            workflow::list_time_by_type,
            records::list_record_phases,
            records::set_record_phase_notes,
            records::set_task_phase,
            records::create_phase_task,
            data::external_changes,
            import::pick_import_files,
            import::import_projects,
            commands::capture::get_capture_hotkey,
            commands::capture::set_capture_hotkey,
            commands::reminders::get_reminders_enabled,
            commands::reminders::set_reminders_enabled,
            commands::reminders::list_reminders,
            commands::reminders::get_notification_prefs,
            commands::reminders::set_notification_prefs,
            data::export_data,
            data::import_data,
            data::delete_all_data,
        ])
}

#[cfg(any(debug_assertions, test))]
fn export_bindings(builder: &Builder<tauri::Wry>, platform: &Builder<tauri::Wry>) {
    builder
        .export(specta_typescript::Typescript::default(), BINDINGS_PATH)
        .expect("TypeScript bindings export");
    platform
        .export(
            specta_typescript::Typescript::default(),
            PLATFORM_BINDINGS_PATH,
        )
        .expect("platform bindings export");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    unsafe {
        std::env::set_var("JSC_useJIT", "0");
    }

    let builder = specta_builder();
    let platform = platform_builder();

    #[cfg(debug_assertions)]
    export_bindings(&builder, &platform);

    let contract_handler = builder.invoke_handler();
    let platform_handler = platform.invoke_handler();

    tauri::Builder::default()
        .plugin(capture::single_instance())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(capture::plugin())
        .invoke_handler(move |invoke| {
            if PLATFORM_COMMANDS.contains(&invoke.message.command()) {
                platform_handler(invoke)
            } else {
                contract_handler(invoke)
            }
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && tray::close_to_tray(window)
            {
                api.prevent_close();
            }
            if let WindowEvent::Focused(true) = event
                && let Some(sync) = window.try_state::<Arc<sync::SyncService>>()
            {
                sync.trigger(sync::Trigger::Focus);
            }
        })
        .setup(move |app| {
            builder.mount_events(app);
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(db::open(&dir.join(db::DATABASE_FILE))?);
            let service = sync::SyncService::new(
                app.handle().clone(),
                Box::new(sync::auth::tokens::KeyringStore),
            );
            let writes = Arc::clone(&service);
            app.state::<db::Db>()
                .on_write(move || writes.trigger(sync::Trigger::Write));
            service.resume();
            app.manage(service);
            app.manage(backup::SeenVersion::default());
            reminders::start(app.handle().clone());
            capture::start(app.handle());
            if let Err(error) = tray::start(app.handle()) {
                eprintln!("skkil time: no tray icon on this system: {error}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn exports_bindings() {
        super::export_bindings(&super::specta_builder(), &super::platform_builder());
    }

    #[test]
    fn every_platform_command_is_routed() {
        super::export_bindings(&super::specta_builder(), &super::platform_builder());
        let bindings = std::fs::read_to_string(super::PLATFORM_BINDINGS_PATH).unwrap();
        for command in super::PLATFORM_COMMANDS {
            assert!(bindings.contains(&format!("\"{command}\"")), "{command}");
        }
    }
}
