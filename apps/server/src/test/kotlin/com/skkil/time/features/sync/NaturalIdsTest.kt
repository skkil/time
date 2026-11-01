package com.skkil.time.features.sync

import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.id.UuidV5
import com.skkil.time.features.projects.api.CanvasContent
import com.skkil.time.features.review.api.DayNote
import com.skkil.time.features.review.api.Felt
import com.skkil.time.features.review.domain.WeekNotes
import com.skkil.time.features.settings.api.Enabled
import com.skkil.time.features.tasks.api.TaskDependency
import com.skkil.time.features.time.domain.EntryDetails
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.io.File
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals

class NaturalIdsTest : TaskApiTest() {
    private val monday = LocalDate.parse("2026-11-02")

    private fun ids(table: String, where: String = "user_id = :user"): List<UUID> =
        jdbc
            .sql("SELECT id FROM $table WHERE $where")
            .param("user", userId())
            .query(UUID::class.java)
            .list()
            .filterNotNull()

    @Test
    fun `names follow the table and key parts`() {
        val scope = UUID.randomUUID()
        val task = UUID.randomUUID()
        val other = UUID.randomUUID()
        assertEquals(UuidV5.of(scope, "week/2026-11-02"), NaturalIds.week(scope, monday))
        assertEquals(UuidV5.of(scope, "day/2026-11-03"), NaturalIds.day(scope, monday.plusDays(1)))
        assertEquals(UuidV5.of(scope, "setting/reminders_enabled"), NaturalIds.setting(scope, "reminders_enabled"))
        assertEquals(UuidV5.of(scope, "habit_log/$task/2026-11-02"), NaturalIds.habitLog(scope, task, monday))
        assertEquals(UuidV5.of(scope, "project_canvas/$task"), NaturalIds.projectCanvas(scope, task))
        assertEquals(UuidV5.of(scope, "record_phase/$task/$other"), NaturalIds.recordPhase(scope, task, other))
        assertEquals(UuidV5.of(scope, "task_dependency/$task/$other"), NaturalIds.taskDependency(scope, task, other))
        assertEquals(UuidV5.of(scope, "running_timer"), NaturalIds.runningTimer(scope))
        assertEquals(UuidV5.of(scope, "user_preference"), NaturalIds.userPreference(scope))
        assertEquals(UuidV5.of(scope, "ritual/morning"), NaturalIds.ritual(scope, "morning"))
    }

    @Test
    fun `match the shared vectors the desktop checks too`() {
        val vectors = mapper.readTree(File("../shared/contract/src/natural-keys.json"))["vectors"].values()
        val kinds = mutableSetOf<String>()
        for (vector in vectors) {
            val kind = vector["kind"].asString()
            val scope = vector.uuid("scope")
            val parts = vector["parts"].values().map { it.asString() }
            val expected = vector.uuid("id")
            val built =
                when (kind) {
                    "setting" -> {
                        NaturalIds.setting(scope, parts[0])
                    }

                    "project_canvas" -> {
                        NaturalIds.projectCanvas(scope, UUID.fromString(parts[0]))
                    }

                    "week" -> {
                        NaturalIds.week(scope, LocalDate.parse(parts[0]))
                    }

                    "day" -> {
                        NaturalIds.day(scope, LocalDate.parse(parts[0]))
                    }

                    "task_dependency" -> {
                        NaturalIds.taskDependency(scope, UUID.fromString(parts[0]), UUID.fromString(parts[1]))
                    }

                    "record_phase" -> {
                        NaturalIds.recordPhase(scope, UUID.fromString(parts[0]), UUID.fromString(parts[1]))
                    }

                    "running_timer" -> {
                        NaturalIds.runningTimer(scope)
                    }

                    "habit_log" -> {
                        NaturalIds.habitLog(scope, UUID.fromString(parts[0]), LocalDate.parse(parts[1]))
                    }

                    "ritual" -> {
                        NaturalIds.ritual(scope, parts[0])
                    }

                    "user_preference" -> {
                        NaturalIds.userPreference(scope)
                    }

                    else -> {
                        error("Unknown natural key kind $kind")
                    }
                }
            assertEquals(expected, built, vector["name"].asString())
            assertEquals(expected, UuidV5.of(scope, vector["name"].asString()))
            kinds += kind
        }
        assertEquals(KINDS, kinds)
    }

    @Test
    fun `upserts by natural key name their rows by it, however often they run`() {
        val scope = scopeId()
        repeat(2) {
            put("/api/v1/weeks/$monday/notes", WeekNotes("a", "b", "c")).andExpect { status { is2xxSuccessful() } }
            put("/api/v1/days/$monday/felt", Felt(4)).andExpect { status { is2xxSuccessful() } }
            put("/api/v1/days/$monday/note", DayNote("ok")).andExpect { status { is2xxSuccessful() } }
            put("/api/v1/settings/reminders", Enabled(it == 0)).andExpect { status { is2xxSuccessful() } }
        }
        val project = project("Notes")
        putJson("/api/v1/projects/$project/canvas", CanvasContent("<p>Plan</p>"))
        postJson("/api/v1/timer", EntryDetails("focus", null, null))
        val launch = create(input("Launch")).id()
        val copy = create(input("Copy")).id()
        read(post("/api/v1/tasks/$launch/dependencies", TaskDependency(copy)))

        assertEquals(listOf(NaturalIds.week(scope, monday)), ids("week"))
        assertEquals(listOf(NaturalIds.day(scope, monday)), ids("day"))
        assertEquals(listOf(NaturalIds.setting(scope, "reminders_enabled")), ids("setting"))
        assertEquals(listOf(NaturalIds.projectCanvas(scope, project)), ids("project_canvas", "project_id = '$project'"))
        assertEquals(listOf(NaturalIds.runningTimer(scope)), ids("running_timer"))
        assertEquals(
            listOf(NaturalIds.taskDependency(scope, launch, copy)),
            ids("task_dependency", "task_id = '$launch'"),
        )
    }

    private companion object {
        /** Every natural key of the decision record's table. */
        val KINDS =
            setOf(
                "setting",
                "project_canvas",
                "week",
                "day",
                "task_dependency",
                "record_phase",
                "running_timer",
                "habit_log",
                "ritual",
                "user_preference",
            )
    }
}
