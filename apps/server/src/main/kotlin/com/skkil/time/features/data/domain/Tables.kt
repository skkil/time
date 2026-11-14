package com.skkil.time.features.data.domain

import java.util.UUID

private fun text(name: String) = Column(name, ColumnType.TEXT)

private fun long(name: String) = Column(name, ColumnType.BIGINT)

private fun int(name: String) = Column(name, ColumnType.INT)

private fun bool(name: String) = Column(name, ColumnType.BOOL)

private fun double(name: String) = Column(name, ColumnType.DOUBLE)

private fun date(name: String) = Column(name, ColumnType.DATE)

private fun ref(name: String, table: String) = Column(name, ColumnType.UUID, table)

private fun id() = Column(ID, ColumnType.UUID)

private const val ID = "id"

private fun projectOwned(name: String, vararg columns: Column) =
    Table(name, true, listOf(id(), ref("project_id", "project")) + columns)

/** Every table a user owns, in an order where each table comes after the tables it references. */
val TABLES: List<Table> =
    listOf(
        Table("setting", false, listOf(text("key"), text("value"))),
        Table("project_group", true, listOf(id(), text("name"), long("position"))),
        Table(
            "project",
            true,
            listOf(
                id(),
                ref("parent_id", "project"),
                text("name"),
                text("color"),
                long("position"),
                bool("archived"),
                text("view"),
                text("external_id"),
                text("status"),
                text("outcome"),
                int("weekly_minutes"),
                date("target_date"),
                text("kill_criteria"),
                int("review_every_weeks"),
                long("last_reviewed_at"),
                bool("in_order"),
                text("preset"),
                text("milestone_label"),
                ref("group_id", "project_group"),
            ),
        ),
        Table(
            "project_canvas",
            false,
            listOf(ref("project_id", "project"), text("content"), long("updated_at")),
            owner = "project_id IN (SELECT id FROM project WHERE user_id = :user)",
        ),
        Table(
            "section",
            true,
            listOf(
                id(),
                ref("project_id", "project"),
                text("name"),
                long("position"),
                bool("collapsed"),
                text("external_id"),
            ),
        ),
        projectOwned(
            "item_type",
            text("name"),
            text("icon"),
            text("kind"),
            int("default_minutes"),
            text("checklist"),
            long("position"),
        ),
        projectOwned("item_status", text("name"), text("category"), long("position")),
        projectOwned("milestone", text("name"), date("date"), long("position")),
        projectOwned(
            "saved_view",
            text("name"),
            text("layout"),
            text("group_by"),
            text("filter"),
            text("sort"),
            long("position"),
        ),
        Table("quarter", true, listOf(id(), text("label"), date("start_date"))),
        Table(
            "priority",
            true,
            listOf(id(), ref("quarter_id", "quarter"), text("title"), text("note"), long("position")),
        ),
        Table(
            "week",
            false,
            listOf(
                date("start_date"),
                text("worked"),
                text("fell_short"),
                text("change"),
                int("felt"),
                int("step"),
                long("reviewed_at"),
            ),
        ),
        Table(
            "outcome",
            true,
            listOf(
                id(),
                date("week_start"),
                ref("priority_id", "priority"),
                text("title"),
                text("status"),
                ref("carried_from", "outcome"),
                long("position"),
            ),
        ),
        Table(
            "day",
            false,
            listOf(date("date"), int("felt"), text("reflection"), long("closed_at"), bool("skipped")),
        ),
        Table(
            "task",
            true,
            listOf(
                id(),
                text("title"),
                text("notes"),
                ref("project_id", "project"),
                date("due_date"),
                int("estimate_minutes"),
                long("completed_at"),
                long("created_at"),
                ref("section_id", "section"),
                ref("parent_id", "task"),
                int("priority"),
                int("due_time"),
                date("deadline"),
                text("recurrence"),
                long("position"),
                text("external_id"),
                ref("outcome_id", "outcome"),
                bool("someday"),
                text("next_step"),
                date("must_on"),
                date("due_until"),
                ref("type_id", "item_type"),
                ref("status_id", "item_status"),
                ref("milestone_id", "milestone"),
                text("location"),
                bool("counts_as_time"),
                long("status_changed_at"),
                ref("phase_id", "item_status"),
                text("reminded_for"),
            ),
        ),
        Table(
            "task_dependency",
            false,
            listOf(ref("task_id", "task"), ref("blocked_by_id", "task")),
            owner = "task_id IN (SELECT id FROM task WHERE user_id = :user)",
        ),
        Table(
            "record_phase",
            false,
            listOf(ref("task_id", "task"), ref("status_id", "item_status"), text("notes")),
            owner = "task_id IN (SELECT id FROM task WHERE user_id = :user)",
        ),
        Table(
            "time_block",
            true,
            listOf(id(), ref("task_id", "task"), long("start_at"), long("end_at"), bool("logged")),
        ),
        Table(
            "time_entry",
            true,
            listOf(
                id(),
                text("description"),
                ref("project_id", "project"),
                ref("task_id", "task"),
                long("started_at"),
                long("ended_at"),
                text("source"),
            ),
        ),
        Table(
            "running_timer",
            false,
            listOf(
                text("description"),
                ref("project_id", "project"),
                ref("task_id", "task"),
                long("started_at"),
                long("paused_at"),
                long("banked_seconds"),
            ),
        ),
        Table(
            "habit",
            true,
            listOf(
                id(),
                text("name"),
                bool("archived"),
                text("kind"),
                double("goal"),
                text("unit"),
                int("days"),
                text("time_of_day"),
                text("area"),
                date("start_date"),
                long("position"),
                text("track_source"),
                text("track_patterns"),
                ref("track_project_id", "project"),
                int("skip_days"),
                text("anchor"),
            ),
        ),
        Table(
            "habit_log",
            false,
            listOf(ref("habit_id", "habit"), date("date"), text("status"), double("value"), text("source")),
            owner = "habit_id IN (SELECT id FROM habit WHERE user_id = :user)",
        ),
        Table(
            "ritual",
            false,
            listOf(
                text("kind"),
                bool("enabled"),
                text("trigger"),
                int("at_minute"),
                int("weekdays"),
                int("min_minutes"),
                text("steps"),
            ),
        ),
        Table(
            "ritual_run",
            true,
            listOf(
                id(),
                text("kind"),
                date("date"),
                ref("task_id", "task"),
                long("started_at"),
                long("finished_at"),
                bool("skipped"),
                int("step"),
                long("snoozed_until"),
            ),
        ),
    )
