package com.skkil.time.features.data.domain

import com.skkil.time.common.id.NaturalIds
import java.time.LocalDate
import java.util.UUID

/**
 * A synced table as `importLocal` writes it: its [columns] (the id first), the column through which a row belongs to
 * the user when the table has no `user_id` ([owner]), the columns that identify a row besides its id ([naturalKey]:
 * `null` when none, empty for one row per account) and, for a natural-key row, its id in a scope from the key's
 * values ([keyedId]).
 */
data class LocalTable(
    val name: String,
    val columns: List<Column>,
    val owner: Column?,
    val naturalKey: List<String>?,
    val keyedId: ((UUID, List<Any>) -> UUID)?,
) {
    val selfReference: Column? = columns.firstOrNull { it.references == name }
}

private val NATURAL_KEYS: Map<String, List<String>> =
    mapOf(
        "project_group" to listOf("name"),
        "place" to listOf("name"),
        "project" to listOf("external_id"),
        "section" to listOf("external_id"),
        "task" to listOf("external_id"),
        "quarter" to listOf("start_date"),
        "setting" to listOf("key"),
        "project_canvas" to listOf("project_id"),
        "week" to listOf("start_date"),
        "day" to listOf("date"),
        "task_dependency" to listOf("task_id", "blocked_by_id"),
        "record_phase" to listOf("task_id", "status_id"),
        "running_timer" to emptyList(),
        "habit_log" to listOf("habit_id", "date"),
        "ritual" to listOf("kind"),
    )

private val KEYED_IDS: Map<String, (UUID, List<Any>) -> UUID> =
    mapOf(
        "setting" to { scope, key -> NaturalIds.setting(scope, key[0] as String) },
        "project_canvas" to { scope, key -> NaturalIds.projectCanvas(scope, key[0] as UUID) },
        "week" to { scope, key -> NaturalIds.week(scope, key[0] as LocalDate) },
        "day" to { scope, key -> NaturalIds.day(scope, key[0] as LocalDate) },
        "task_dependency" to { scope, key -> NaturalIds.taskDependency(scope, key[0] as UUID, key[1] as UUID) },
        "record_phase" to { scope, key -> NaturalIds.recordPhase(scope, key[0] as UUID, key[1] as UUID) },
        "running_timer" to { scope, _ -> NaturalIds.runningTimer(scope) },
        "habit_log" to { scope, key -> NaturalIds.habitLog(scope, key[0] as UUID, key[1] as LocalDate) },
        "ritual" to { scope, key -> NaturalIds.ritual(scope, key[0] as String) },
    )

/**
 * Every table a device syncs, in the order `importLocal` writes them (parents before children), as the desktop lists
 * them in `time_core::data::SYNCED_TABLES`, with the natural keys of its `NATURAL_KEYS`. `user_preference` and the
 * connected calendars (`calendar_source`, `calendar_event`) are the server's own and never uploaded.
 */
val LOCAL_TABLES: List<LocalTable> =
    listOf(
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
    ).map { name ->
        val table = TABLES.single { it.name == name }
        LocalTable(
            name = name,
            columns = listOf(Column("id", ColumnType.UUID)) + table.columns.filter { it.name != "id" },
            owner = if (table.ownedDirectly) null else table.columns.first { it.references != null },
            naturalKey = NATURAL_KEYS[name],
            keyedId = KEYED_IDS[name],
        )
    }
