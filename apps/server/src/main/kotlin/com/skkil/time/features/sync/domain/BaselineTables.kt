package com.skkil.time.features.sync.domain

/** Every table registered with store (`V13`), parents before the tables that reference them. */
val BASELINE_TABLES: List<BaselineTable> =
    listOf(
        BaselineTable("setting"),
        BaselineTable("project_group"),
        BaselineTable("place"),
        BaselineTable("project"),
        BaselineTable("project_canvas", "project_id", "project"),
        BaselineTable("section"),
        BaselineTable("item_type"),
        BaselineTable("item_status"),
        BaselineTable("milestone"),
        BaselineTable("saved_view"),
        BaselineTable("quarter"),
        BaselineTable("priority"),
        BaselineTable("week"),
        BaselineTable("outcome"),
        BaselineTable("day"),
        BaselineTable("task"),
        BaselineTable("task_dependency", "task_id", "task"),
        BaselineTable("record_phase", "task_id", "task"),
        BaselineTable("time_block"),
        BaselineTable("time_entry"),
        BaselineTable("running_timer"),
        BaselineTable("habit"),
        BaselineTable("habit_log", "habit_id", "habit"),
        BaselineTable("ritual"),
        BaselineTable("ritual_run"),
        BaselineTable("user_preference"),
        BaselineTable("calendar_source"),
        BaselineTable("calendar_event"),
    )
