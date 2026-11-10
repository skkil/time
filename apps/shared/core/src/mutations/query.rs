use rusqlite::Connection;
use serde_json::Value;

use super::args::{Args, out};
use crate::error::{Error, Result};
use crate::rituals::Moment;
use crate::types::{Date, Timestamp};
use crate::{
    blocks, calendar, canvas, glance, groups, habits, projects, records, reminders, review,
    rituals, sections, tasks, time_entries, undo, workflow,
};

/// Answers one read command by its contract name from the local database.
pub fn query(conn: &Connection, name: &str, args: &Value) -> Result<Value> {
    let a = Args::new(args)?;
    match name {
        "listProjects" => out(projects::list(conn)?),
        "listGroups" => out(groups::list(conn)?),
        "getProjectCanvas" => out(canvas::get(conn, &a.id("projectId")?)?),
        "listTasks" => out(tasks::list(conn)?),
        "getTask" => out(tasks::get(conn, &a.id("id")?)?),
        "captureTasks" => out(undo::capture(conn, &a.get::<Vec<_>>("ids")?)?),
        "listSections" => out(sections::list(conn)?),
        "listBlocks" => out(blocks::list(conn, a.get("from")?, a.get("to")?)?),
        "listTimeEntries" => out(time_entries::list(conn, a.get("from")?, a.get("to")?)?),
        "listTaskEntries" => out(time_entries::list_for_task(conn, &a.id("taskId")?)?),
        "listProjectEntries" => out(time_entries::list_for_project(conn, &a.id("projectId")?)?),
        "getTimer" => out(time_entries::running(conn)?),
        "todayGlance" => out(glance::today_glance(conn, Timestamp::now(), Date::today())?),
        "listHabits" => out(habits::list(conn)?),
        "listHabitDays" => out(habits::days(conn, a.get("from")?, a.get("to")?)?),
        "listDays" => out(review::days(conn, a.get("from")?, a.get("to")?)?),
        "getWeek" => out(review::week(conn, a.get("date")?)?),
        "listWeeks" => out(review::weeks(conn, a.get("from")?, a.get("to")?)?),
        "getQuarter" => out(review::quarter_for(conn, a.get("date")?)?),
        "listRituals" => out(rituals::list(conn)?),
        "getPlanningTime" => out(rituals::planning_time(conn)?),
        "dueRitual" => out(rituals::due(conn, Moment::now(), a.get("event")?)?),
        "getReviewDay" => out(rituals::review_day(conn)?),
        "weekToClose" => out(rituals::week_to_close(
            conn,
            Moment::now(),
            &a.text("kind")?,
        )?),
        "listRitualRuns" => out(rituals::runs(conn, a.get("from")?, a.get("to")?)?),
        "getWorkflow" => out(workflow::list(conn)?),
        "listPresets" => out(workflow::presets()),
        "readPreset" => out(workflow::parse_preset(&a.text("text")?)?),
        "saveProjectPreset" => out(workflow::export_preset(conn, &a.id("id")?)?),
        "listEvents" => out(workflow::occurrences(conn, a.get("from")?, a.get("to")?)?),
        "listTimeByType" => out(workflow::time_by_type(conn, a.get("from")?, a.get("to")?)?),
        "listRecordPhases" => out(records::phases(conn, &a.id("taskId")?)?),
        "getRemindersEnabled" => out(reminders::enabled(conn)?),
        "listReminders" => out(reminders::upcoming(
            conn,
            a.get("from")?,
            a.get("to")?,
            &a.get("prefs")?,
        )?),
        "getAutoLogBlocks" => out(blocks::auto_log_enabled(conn)?),
        "countEndedBlocks" => out(blocks::count_ended(conn, Timestamp::now())?),
        "listCalendarSources" => out(calendar::sources(conn)?),
        "listCalendarEvents" => out(calendar::events(conn, a.get("from")?, a.get("to")?)?),
        other => Err(Error::invalid(format!("{other} isn't a read."))),
    }
}
