mod activitywatch;
mod db;
mod error;
mod features;
mod recurrence;
mod types;

use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{Builder, ErrorHandlingMode, collect_commands};

use features::{
    blocks, canvas, data, dependencies, groups, habits, projects, records, review, rituals,
    sections, tasks, time_entries, workflow,
};

const BINDINGS_PATH: &str = "../src/bindings.ts";

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
            tasks::create_task,
            tasks::update_task,
            tasks::move_task,
            tasks::reschedule_tasks,
            tasks::set_task_completed,
            tasks::set_task_outcome,
            tasks::set_tasks_someday,
            tasks::set_task_must,
            tasks::set_task_next_step,
            tasks::delete_tasks,
            tasks::delete_task,
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
            time_entries::list_time_entries,
            time_entries::create_time_entry,
            time_entries::update_time_entry,
            time_entries::delete_time_entry,
            time_entries::get_timer,
            time_entries::start_timer,
            time_entries::edit_timer,
            time_entries::stop_timer,
            time_entries::discard_timer,
            habits::list_habits,
            habits::create_habit,
            habits::update_habit,
            habits::archive_habit,
            habits::list_habit_days,
            habits::set_habit_status,
            habits::add_habit_value,
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
            data::delete_all_data,
        ])
}

fn export_bindings(builder: &Builder<tauri::Wry>) {
    builder
        .export(Typescript::default(), BINDINGS_PATH)
        .expect("TypeScript bindings export");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    unsafe {
        std::env::set_var("JSC_useJIT", "0");
    }

    let builder = specta_builder();

    #[cfg(debug_assertions)]
    export_bindings(&builder);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(db::Db::open(&dir.join("time.db"))?);
            app.manage(time_entries::Timer::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn exports_bindings() {
        super::export_bindings(&super::specta_builder());
    }
}
