/// Every table that syncs through store, each keyed by its `id` column and
/// listed after every table it references. Device state (`device_setting`,
/// the sync bookkeeping) is not listed and never syncs.
pub const SYNCED_TABLES: [&str; 27] = [
    "project_group",
    "place",
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
    "calendar_source",
    "calendar_event",
];

/// The row id column of every synced table.
pub const ID_COLUMN: &str = "id";

/// Every column of a synced table that holds the id of another synced row,
/// as `(table, column, referenced table)`.
pub const REFERENCES: [(&str, &str, &str); 33] = [
    ("project", "parent_id", "project"),
    ("project", "group_id", "project_group"),
    ("project_canvas", "project_id", "project"),
    ("section", "project_id", "project"),
    ("priority", "quarter_id", "quarter"),
    ("outcome", "priority_id", "priority"),
    ("outcome", "carried_from", "outcome"),
    ("item_type", "project_id", "project"),
    ("item_status", "project_id", "project"),
    ("milestone", "project_id", "project"),
    ("saved_view", "project_id", "project"),
    ("task", "project_id", "project"),
    ("task", "section_id", "section"),
    ("task", "parent_id", "task"),
    ("task", "outcome_id", "outcome"),
    ("task", "type_id", "item_type"),
    ("task", "status_id", "item_status"),
    ("task", "milestone_id", "milestone"),
    ("task", "phase_id", "item_status"),
    ("task", "place_id", "place"),
    ("task_dependency", "task_id", "task"),
    ("task_dependency", "blocked_by_id", "task"),
    ("record_phase", "task_id", "task"),
    ("record_phase", "status_id", "item_status"),
    ("time_block", "task_id", "task"),
    ("time_entry", "project_id", "project"),
    ("time_entry", "task_id", "task"),
    ("running_timer", "project_id", "project"),
    ("running_timer", "task_id", "task"),
    ("habit", "track_project_id", "project"),
    ("habit_log", "habit_id", "habit"),
    ("ritual_run", "task_id", "task"),
    ("calendar_event", "source_id", "calendar_source"),
];

/// What identifies a row besides its id, as `(table, columns)`: an account
/// holds at most one row per value (group and place names ignore case; an
/// empty list means one row per account). The server keeps the same keys.
pub const NATURAL_KEYS: [(&str, &[&str]); 15] = [
    ("project_group", &["name"]),
    ("place", &["name"]),
    ("project", &["external_id"]),
    ("section", &["external_id"]),
    ("task", &["external_id"]),
    ("quarter", &["start_date"]),
    ("setting", &["key"]),
    ("project_canvas", &["project_id"]),
    ("week", &["start_date"]),
    ("day", &["date"]),
    ("task_dependency", &["task_id", "blocked_by_id"]),
    ("record_phase", &["task_id", "status_id"]),
    ("running_timer", &[]),
    ("habit_log", &["habit_id", "date"]),
    ("ritual", &["kind"]),
];

/// Synced tables the server fills from a connected calendar account. Their
/// rows belong to that connection rather than to the device: they are never
/// dumped, imported or wiped here, and `calendar_event` takes no local write.
pub const CONNECTED_TABLES: [&str; 2] = ["calendar_source", "calendar_event"];

/// Synced tables only the server writes.
pub const SERVER_TABLES: [&str; 1] = ["calendar_event"];

pub fn is_connected(table: &str) -> bool {
    CONNECTED_TABLES.contains(&table)
}

pub fn is_synced(table: &str) -> bool {
    SYNCED_TABLES.contains(&table)
}
