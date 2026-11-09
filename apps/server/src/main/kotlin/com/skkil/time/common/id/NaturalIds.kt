package com.skkil.time.common.id

import java.time.LocalDate
import java.util.UUID

/**
 * Ids of rows identified by something other than their id: `UuidV5(scope, "<table>/<key parts joined by />")`, with
 * uuids in lowercase canonical form and dates as `yyyy-MM-dd`. Two devices that create the same row offline name it
 * the same, so an upsert by natural key never makes a second row. Devices build the same names in time-core, and
 * `natural-keys.json` in `apps/shared/client/src/types` holds the vectors both sides test against.
 */
object NaturalIds {
    fun setting(scope: UUID, key: String): UUID = of(scope, "setting", key)

    fun projectCanvas(scope: UUID, projectId: UUID): UUID = of(scope, "project_canvas", projectId)

    fun week(scope: UUID, monday: LocalDate): UUID = of(scope, "week", monday)

    fun day(scope: UUID, date: LocalDate): UUID = of(scope, "day", date)

    fun taskDependency(scope: UUID, taskId: UUID, blockedById: UUID): UUID =
        of(scope, "task_dependency", taskId, blockedById)

    fun recordPhase(scope: UUID, taskId: UUID, statusId: UUID): UUID = of(scope, "record_phase", taskId, statusId)

    fun runningTimer(scope: UUID): UUID = of(scope, "running_timer")

    fun habitLog(scope: UUID, habitId: UUID, date: LocalDate): UUID = of(scope, "habit_log", habitId, date)

    fun ritual(scope: UUID, kind: String): UUID = of(scope, "ritual", kind)

    fun userPreference(scope: UUID): UUID = of(scope, "user_preference")

    private fun of(scope: UUID, table: String, vararg key: Any): UUID =
        UuidV5.of(scope, (listOf(table) + key.map(Any::toString)).joinToString("/"))
}
