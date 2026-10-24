/// Every table that syncs through store, each keyed by its `id` column and
/// listed after every table it references. Device state (`device_setting`,
/// the sync bookkeeping) is not listed and never syncs.
pub const SYNCED_TABLES: [&str; 24] = [
    "project_group",
    "project",
    "project_canvas",
    "section",
    "quarter",
    "priority",
    "week",
    "outcome",
    "day",
    "item_type",
    "item_status",
    "milestone",
    "saved_view",
    "task",
    "task_dependency",
    "record_phase",
    "time_block",
    "time_entry",
    "running_timer",
    "habit",
    "habit_log",
    "ritual",
    "ritual_run",
    "setting",
];

/// The row id column of every synced table.
pub const ID_COLUMN: &str = "id";

pub fn is_synced(table: &str) -> bool {
    SYNCED_TABLES.contains(&table)
}
