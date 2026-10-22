use rusqlite::Connection;
use serde_json::Value;

use super::args::{Args, out};
use crate::env::MutationEnv;
use crate::error::{Error, Result};
use crate::{
    blocks, canvas, dependencies, groups, habits, imports, projects, records, reminders, review,
    rituals, sections, tasks, time_entries, workflow,
};

/// Applies one write command by its contract name. Run it inside a
/// transaction: a mutation either applies whole or not at all.
pub fn apply(conn: &Connection, env: &impl MutationEnv, name: &str, args: &Value) -> Result<Value> {
    let env: &dyn MutationEnv = env;
    let a = Args::new(args)?;
    match name {
        "createProject" => out(projects::create(conn, env, &a.get("input")?)?),
        "updateProject" => out(projects::update(conn, &a.id("id")?, &a.get("input")?)?),
        "setProjectArchived" => out(projects::set_archived(
            conn,
            &a.id("id")?,
            a.get("archived")?,
        )?),
        "setProjectView" => out(projects::set_view(conn, &a.id("id")?, &a.text("view")?)?),
        "updateProjectSettings" => out(projects::update_settings(
            conn,
            &a.id("id")?,
            &a.get("settings")?,
        )?),
        "markProjectReviewed" => out(projects::mark_reviewed(conn, env, &a.id("id")?)?),
        "deleteProject" => out(projects::delete(conn, &a.id("id")?)?),

        "addTaskDependency" => out(dependencies::add(
            conn,
            &a.id("taskId")?,
            &a.id("blockedById")?,
        )?),
        "removeTaskDependency" => out(dependencies::remove(
            conn,
            &a.id("taskId")?,
            &a.id("blockedById")?,
        )?),

        "createGroup" => out(groups::create(conn, env, &a.text("name")?)?),
        "renameGroup" => out(groups::rename(conn, &a.id("id")?, &a.text("name")?)?),
        "deleteGroup" => out(groups::delete(conn, &a.id("id")?)?),

        "saveProjectCanvas" => out(canvas::save(
            conn,
            env,
            &a.id("projectId")?,
            &a.text("content")?,
        )?),

        "createTask" => out(tasks::create(conn, env, &a.get("input")?)?),
        "updateTask" => out(tasks::update(conn, &a.id("id")?, &a.get("input")?)?),
        "moveTask" => out(tasks::move_to(conn, &a.id("id")?, &a.get("placement")?)?),
        "rescheduleTasks" => out(tasks::reschedule(
            conn,
            env,
            &a.get::<Vec<_>>("ids")?,
            a.get("dueDate")?,
        )?),
        "setTaskCompleted" => out(tasks::set_completed(
            conn,
            env,
            &a.id("id")?,
            a.get("completed")?,
        )?),
        "setTaskOutcome" => out(tasks::set_outcome(
            conn,
            &a.id("id")?,
            a.opt_id("outcomeId")?.as_ref(),
        )?),
        "setTasksSomeday" => out(tasks::set_someday(
            conn,
            &a.get::<Vec<_>>("ids")?,
            a.get("someday")?,
        )?),
        "setTaskMust" => out(tasks::set_must(conn, &a.id("id")?, a.get("mustOn")?)?),
        "setTaskNextStep" => out(tasks::set_next_step(
            conn,
            &a.id("id")?,
            &a.text("nextStep")?,
        )?),
        "deleteTasks" => out(tasks::delete_many(conn, &a.get::<Vec<_>>("ids")?)?),
        "deleteTask" => out(tasks::delete(conn, &a.id("id")?)?),

        "createSection" => out(sections::create(
            conn,
            env,
            a.opt_id("projectId")?.as_ref(),
            &a.text("name")?,
            a.opt_id("before")?.as_ref(),
        )?),
        "renameSection" => out(sections::rename(conn, &a.id("id")?, &a.text("name")?)?),
        "setSectionCollapsed" => out(sections::set_collapsed(
            conn,
            &a.id("id")?,
            a.get("collapsed")?,
        )?),
        "reorderSection" => out(sections::reorder(
            conn,
            &a.id("id")?,
            a.opt_id("before")?.as_ref(),
        )?),
        "deleteSection" => out(sections::delete(conn, &a.id("id")?)?),

        "createBlock" => out(blocks::create(
            conn,
            env,
            &a.id("taskId")?,
            &a.get("span")?,
        )?),
        "rescheduleBlock" => out(blocks::reschedule(conn, &a.id("id")?, &a.get("span")?)?),
        "deleteBlock" => out(blocks::delete(conn, &a.id("id")?)?),

        "createTimeEntry" => out(time_entries::create(conn, env, &a.get("input")?)?),
        "updateTimeEntry" => out(time_entries::update(
            conn,
            env,
            &a.id("id")?,
            &a.get("input")?,
        )?),
        "deleteTimeEntry" => out(time_entries::delete(conn, &a.id("id")?)?),
        "startTimer" => out(time_entries::start(conn, env, &a.get("details")?)?),
        "editTimer" => out(time_entries::edit_running(conn, &a.get("details")?)?),
        "stopTimer" => out(time_entries::stop(conn, env)?),
        "pauseTimer" => out(time_entries::pause(conn, env)?),
        "resumeTimer" => out(time_entries::resume(conn, env)?),
        "discardTimer" => out(time_entries::discard(conn)?),
        "restoreTimer" => out(time_entries::restore_running(conn, &a.get("timer")?)?),

        "createHabit" => out(habits::create(conn, env, &a.get("input")?)?),
        "updateHabit" => out(habits::update(conn, &a.id("id")?, &a.get("input")?)?),
        "archiveHabit" => out(habits::archive(conn, &a.id("id")?)?),
        "setHabitStatus" => out(habits::set_status(
            conn,
            env,
            &a.id("habitId")?,
            a.get("date")?,
            a.get("status")?,
        )?),
        "addHabitValue" => out(habits::add_value(
            conn,
            env,
            &a.id("habitId")?,
            a.get("date")?,
            a.get("delta")?,
        )?),

        "recordHabitMeasurements" => out(habits::record_measurements(
            conn,
            env,
            &a.get::<Vec<_>>("measurements")?,
        )?),

        "rateDay" => out(review::set_day_felt(
            conn,
            env,
            a.get("date")?,
            a.get("felt")?,
        )?),
        "saveDayNote" => out(review::set_day_note(
            conn,
            env,
            a.get("date")?,
            &a.text("note")?,
        )?),
        "skipDayCheckIn" => out(review::skip_day(conn, a.get("date")?)?),
        "saveWeekNotes" => out(review::save_notes(conn, a.get("date")?, &a.get("notes")?)?),
        "rateWeek" => out(review::set_week_felt(conn, a.get("date")?, a.get("felt")?)?),
        "reachReviewStep" => out(review::set_week_step(conn, a.get("date")?, a.get("step")?)?),
        "finishWeekReview" => out(review::finish_week(conn, env, a.get("date")?)?),
        "createOutcome" => out(review::add_outcome(
            conn,
            env,
            a.get("date")?,
            &a.text("title")?,
            a.opt_id("priorityId")?.as_ref(),
        )?),
        "updateOutcome" => out(review::rename_outcome(
            conn,
            &a.id("id")?,
            &a.text("title")?,
            a.opt_id("priorityId")?.as_ref(),
        )?),
        "updateOutcomeStatus" => out(review::set_outcome_status(
            conn,
            env,
            &a.id("id")?,
            a.get("status")?,
        )?),
        "removeOutcome" => out(review::delete_outcome(conn, &a.id("id")?)?),
        "upsertQuarter" => out(review::save_quarter(
            conn,
            env,
            a.opt_id("id")?.as_ref(),
            &a.text("label")?,
            a.get("startDate")?,
        )?),
        "createPriority" => out(review::add_priority(
            conn,
            env,
            &a.id("quarterId")?,
            &a.text("title")?,
        )?),
        "updatePriority" => out(review::edit_priority(
            conn,
            &a.id("id")?,
            &a.text("title")?,
            &a.text("note")?,
        )?),
        "removePriority" => out(review::delete_priority(conn, &a.id("id")?)?),

        "updateRitual" => out(rituals::update(conn, &a.text("kind")?, &a.get("input")?)?),
        "choosePlanningTime" => out(rituals::set_planning_time(conn, &a.text("time")?)?),
        "startRitual" => out(rituals::start(
            conn,
            env,
            &a.text("kind")?,
            a.opt_id("taskId")?.as_ref(),
        )?),
        "reachRitualStep" => out(rituals::reach_step(conn, &a.id("id")?, a.get("step")?)?),
        "finishRitual" => out(rituals::finish(conn, env, &a.id("id")?)?),
        "skipRitual" => out(rituals::skip(conn, &a.id("id")?)?),
        "snoozeRitual" => out(rituals::snooze(conn, env, &a.id("id")?)?),

        "createItemType" => out(workflow::create_type(
            conn,
            env,
            &a.id("projectId")?,
            &a.get("input")?,
        )?),
        "updateItemType" => out(workflow::update_type(conn, &a.id("id")?, &a.get("input")?)?),
        "deleteItemType" => out(workflow::delete_type(
            conn,
            &a.id("id")?,
            a.opt_id("replacement")?.as_ref(),
        )?),
        "createItemStatus" => out(workflow::create_status(
            conn,
            env,
            &a.id("projectId")?,
            &a.get("input")?,
        )?),
        "updateItemStatus" => out(workflow::update_status(
            conn,
            env,
            &a.id("id")?,
            &a.get("input")?,
        )?),
        "reorderItemStatus" => out(workflow::reorder_status(
            conn,
            &a.id("id")?,
            a.opt_id("before")?.as_ref(),
        )?),
        "deleteItemStatus" => out(workflow::delete_status(
            conn,
            env,
            &a.id("id")?,
            a.opt_id("replacement")?.as_ref(),
        )?),
        "createProjectMilestone" => out(workflow::create_milestone(
            conn,
            env,
            &a.id("projectId")?,
            &a.get("input")?,
        )?),
        "updateProjectMilestone" => out(workflow::update_milestone(
            conn,
            &a.id("id")?,
            &a.get("input")?,
        )?),
        "deleteProjectMilestone" => out(workflow::delete_milestone(conn, &a.id("id")?)?),
        "setProjectMilestoneLabel" => out(workflow::set_milestone_label(
            conn,
            &a.id("id")?,
            &a.text("label")?,
        )?),
        "createSavedView" => out(workflow::create_view(
            conn,
            env,
            &a.id("projectId")?,
            &a.get("input")?,
        )?),
        "updateSavedView" => out(workflow::update_view(conn, &a.id("id")?, &a.get("input")?)?),
        "deleteSavedView" => out(workflow::delete_view(conn, &a.id("id")?)?),
        "applyProjectPreset" => out(workflow::apply_preset(
            conn,
            env,
            &a.id("id")?,
            &a.get("preset")?,
        )?),
        "setTaskTypeId" => out(workflow::set_task_type(
            conn,
            env,
            &a.id("id")?,
            a.opt_id("typeId")?.as_ref(),
        )?),
        "setTaskStatusId" => out(workflow::set_task_status(
            conn,
            env,
            &a.id("id")?,
            &a.id("statusId")?,
        )?),
        "setTaskMilestoneId" => out(workflow::set_task_milestone(
            conn,
            &a.id("id")?,
            a.opt_id("milestoneId")?.as_ref(),
        )?),
        "setTaskEventDetails" => out(workflow::set_task_event(
            conn,
            &a.id("id")?,
            &a.text("location")?,
            a.get("countsAsTime")?,
        )?),

        "setRecordPhaseNotes" => out(records::set_notes(
            conn,
            &a.id("taskId")?,
            &a.id("statusId")?,
            &a.text("notes")?,
        )?),
        "setTaskPhase" => out(records::set_phase(
            conn,
            &a.id("id")?,
            a.opt_id("phaseId")?.as_ref(),
        )?),
        "createPhaseTask" => out(records::create_task(
            conn,
            env,
            &a.id("recordId")?,
            &a.id("phaseId")?,
            &a.text("title")?,
        )?),

        "importProjects" => out(imports::import(conn, env, &a.get::<Vec<_>>("projects")?)?),
        "setRemindersEnabled" => out(reminders::set_enabled(conn, a.get("enabled")?)?),

        other => Err(Error::invalid(format!("{other} isn't a mutation."))),
    }
}
