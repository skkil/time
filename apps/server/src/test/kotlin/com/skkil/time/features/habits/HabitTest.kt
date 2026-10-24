package com.skkil.time.features.habits

import com.skkil.time.features.habits.api.HabitDelta
import com.skkil.time.features.habits.api.HabitStatus
import com.skkil.time.features.habits.domain.HabitInput
import com.skkil.time.features.habits.domain.HabitMeasurement
import com.skkil.time.features.habits.domain.ManualStatus
import com.skkil.time.features.habits.domain.Tracking
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class HabitTest : ApiTest() {
    private fun today(): LocalDate = LocalDate.now(ZoneId.of(zone))

    private fun input(name: String, kind: String) =
        HabitInput(name, kind, 1.0, "times", 0b111_1111, "anytime", "", today().minusDays(10), null, 0, "")

    private fun create(input: HabitInput): JsonNode = postJson("/api/v1/habits", input)

    private fun habit(id: UUID): JsonNode = getJson("/api/v1/habits").values().first { it.id() == id }

    private fun statusOn(habit: UUID, date: LocalDate): String =
        getJson("/api/v1/habits/days?from=$date&to=${date.plusDays(1)}")
            .values()
            .first { it.uuid("habitId") == habit }["status"]
            .asString()

    private fun addValue(habit: UUID, date: LocalDate, delta: Double) =
        post("/api/v1/habits/$habit/days/$date/value", HabitDelta(delta))

    private fun setStatus(habit: UUID, date: LocalDate, status: ManualStatus?) =
        put("/api/v1/habits/$habit/days/$date/status", HabitStatus(status))

    private fun sync(): JsonNode = postJson("/api/v1/habits/sync")

    private fun project(name: String) = postJson("/api/v1/projects", ProjectInput(name, null, "green")).id()

    private fun logEntry(project: UUID, start: Long, minutes: Long) {
        asServer {
            jdbc
                .sql(
                    """
                INSERT INTO time_entry (id, user_id, project_id, started_at, ended_at)
                VALUES (gen_random_uuid(), :user, :project, :start, :end)
                """,
                ).param("user", userId())
                .param("project", project)
                .param("start", start)
                .param("end", start + minutes * 60)
                .update()
        }
    }

    private fun startOf(date: LocalDate): Long = date.atStartOfDay(ZoneId.of(zone)).toEpochSecond()

    @Test
    fun `build habits count toward a goal`() {
        val water = create(input("Drink water", "build").copy(goal = 3.0)).id()
        val today = today()
        addValue(water, today, 2.0).andExpect { status { isNoContent() } }
        assertEquals("pending", statusOn(water, today))
        addValue(water, today, 1.0)
        assertEquals("done", statusOn(water, today))
        assertEquals("missed", statusOn(water, today.minusDays(1)))
        setStatus(water, today.minusDays(1), ManualStatus.SKIPPED).andExpect { status { isNoContent() } }
        assertEquals("skipped", statusOn(water, today.minusDays(1)))
        val habit = habit(water)
        assertEquals(1 to 10, habit["doneDays"].asInt() to habit["dueDays"].asInt())
        assertNull(habit["cleanSince"].takeUnless { it.isNull })
        expectProblem(addValue(water, today.plusDays(1), 1.0), 422, "invalid")
    }

    @Test
    fun `values never drop below zero`() {
        val water = create(input("Drink water", "build").copy(goal = 3.0)).id()
        addValue(water, today(), -5.0)
        addValue(water, today(), 2.0)
        val day = getJson("/api/v1/habits/days?from=${today()}&to=${today().plusDays(1)}").values().first()
        assertEquals(2.0, day["value"].asDouble())
        assertEquals(true, day["manual"].asBoolean())
    }

    @Test
    fun `quit habits hold until a slip`() {
        val habit = create(input("No doomscrolling", "quit"))
        val id = habit.id()
        val today = today()
        assertEquals(0.0, habit["goal"].asDouble())
        assertEquals("done", statusOn(id, today.minusDays(3)))
        assertEquals("pending", statusOn(id, today))
        assertEquals(10 to 10, habit["doneDays"].asInt() to habit["dueDays"].asInt())
        assertEquals(today.minusDays(10).toString(), habit["cleanSince"].asString())

        setStatus(id, today.minusDays(4), ManualStatus.FAILED)
        val slipped = habit(id)
        assertEquals(9 to 10, slipped["doneDays"].asInt() to slipped["dueDays"].asInt())
        assertEquals(today.minusDays(3).toString(), slipped["cleanSince"].asString())
    }

    @Test
    fun `planned skip days forgive one miss a week`() {
        val today = today()
        val walk =
            create(input("Walk", "build").copy(startDate = today.minusDays(6), skipDays = 1, anchor = "After lunch"))
        val weeks =
            (1L..6L).map {
                today.minusDays(it).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            }.toSet()
        assertEquals(0, walk["doneDays"].asInt())
        assertEquals(6 - weeks.size, walk["dueDays"].asInt())
        assertEquals("After lunch", walk["anchor"].asString())

        expectProblem(post("/api/v1/habits", input("Walk", "build").copy(skipDays = 3)), 422, "invalid")
    }

    @Test
    fun `repeat days turn other days off`() {
        val today = today()
        val gym = create(input("Gym", "build").copy(days = 1 shl (today.dayOfWeek.value - 1))).id()
        assertEquals("pending", statusOn(gym, today))
        assertEquals("off", statusOn(gym, today.minusDays(1)))
        assertEquals("missed", statusOn(gym, today.minusDays(7)))
        assertEquals("off", statusOn(gym, today.minusDays(11)))
    }

    @Test
    fun `limit habits allow usage up to the goal`() {
        val games = create(input("Games under 30 min", "limit").copy(goal = 30.0, unit = "minutes")).id()
        addValue(games, today().minusDays(2), 20.0)
        addValue(games, today().minusDays(1), 45.0)
        assertEquals("done", statusOn(games, today().minusDays(2)))
        assertEquals("failed", statusOn(games, today().minusDays(1)))
    }

    @Test
    fun `website and app tracking round-trip but ActivityWatch is unreachable`() {
        assertEquals("notNeeded", sync()["activitywatch"].asString())
        val quit =
            create(
                input("Stay off YouTube", "quit")
                    .copy(tracking = Tracking("website", listOf("https://www.YouTube.com/feed", " "), null)),
            )
        val tracking = quit["tracking"]
        assertEquals(listOf("youtube.com"), tracking["patterns"].values().map { it.asString() })
        assertNull(tracking["projectId"].takeUnless { it.isNull })
        expectProblem(addValue(quit.id(), today(), 1.0), 422, "invalid")

        val report = sync()
        assertEquals("unreachable", report["activitywatch"].asString())
        assertEquals(false, report["hasWebData"].asBoolean())
        assertEquals(false, report["hasWindowData"].asBoolean())
        assertNull(report["message"].takeUnless { it.isNull })

        val app = create(input("Games", "limit").copy(tracking = Tracking("app", listOf(" steam "), null)))
        assertEquals(listOf("steam"), app["tracking"]["patterns"].values().map { it.asString() })
    }

    @Test
    fun `tracking is validated`() {
        fun rejects(tracking: Tracking, message: String) =
            post("/api/v1/habits", input("Tracked", "build").copy(tracking = tracking)).andExpect {
                status { isEqualTo(422) }
                jsonPath("$.detail") { value(message) }
            }
        rejects(Tracking("calendar", emptyList(), null), "Unknown tracking source: calendar")
        rejects(Tracking("website", listOf("  "), null), "Add at least one website.")
        rejects(Tracking("app", emptyList(), null), "Add at least one app name.")
        rejects(Tracking("project", emptyList(), null), "Pick a project to track.")
        expectProblem(
            post(
                "/api/v1/habits",
                input("Tracked", "build").copy(tracking = Tracking("project", emptyList(), UUID.randomUUID())),
            ),
            404,
            "notFound",
        )
        expectProblem(post("/api/v1/habits", input("Drink", "build").copy(goal = 0.0)), 422, "invalid")
        expectProblem(post("/api/v1/habits", input("Drink", "build").copy(goal = null)), 422, "invalid")
        expectProblem(post("/api/v1/habits", input("Drink", "build").copy(days = 0)), 422, "invalid")
        expectProblem(post("/api/v1/habits", input("Drink", "sometimes")), 422, "invalid")
    }

    @Test
    fun `project time completes a build habit`() {
        zone = "Asia/Seoul"
        val study = project("Study")
        val chapter = postJson("/api/v1/projects", ProjectInput("Chapter", study, "green")).id()
        val habit =
            create(input("Study 1h", "build").copy(goal = 60.0, tracking = Tracking("project", listOf(), study)))
        assertEquals("minutes", habit["unit"].asString())

        val yesterday = today().minusDays(1)
        logEntry(chapter, startOf(yesterday) + 9 * 3600, 75)
        logEntry(study, startOf(today()) - 30 * 60, 60)
        assertEquals("notNeeded", sync()["activitywatch"].asString())
        assertEquals("done", statusOn(habit.id(), yesterday))
        val day =
            getJson("/api/v1/habits/days?from=$yesterday&to=${today()}").values().first {
                it.uuid("habitId") ==
                    habit.id()
            }
        assertEquals(105.0, day["value"].asDouble())
        assertEquals(false, day["manual"].asBoolean())
        assertEquals(
            30.0,
            getJson(
                "/api/v1/habits/days?from=${today()}&to=${today().plusDays(1)}",
            ).values().first()["value"].asDouble(),
        )
    }

    @Test
    fun `a status set by hand beats measured time`() {
        val study = project("Study")
        val id = create(input("Study", "build").copy(goal = 60.0, tracking = Tracking("project", listOf(), study))).id()
        val yesterday = today().minusDays(1)
        logEntry(study, startOf(yesterday) + 3600, 90)
        setStatus(id, yesterday, ManualStatus.SKIPPED)
        sync()
        assertEquals("skipped", statusOn(id, yesterday))
        setStatus(id, yesterday, null)
        assertEquals("done", statusOn(id, yesterday))
    }

    @Test
    fun `changing tracking clears measured values`() {
        val study = project("Study")
        val tracked = input("Study", "build").copy(goal = 60.0, tracking = Tracking("project", listOf(), study))
        val id = create(tracked).id()
        val yesterday = today().minusDays(1)
        logEntry(study, startOf(yesterday) + 3600, 90)
        sync()
        setStatus(id, today().minusDays(2), ManualStatus.DONE)
        putJson("/api/v1/habits/$id", tracked.copy(name = "Study more"))
        assertEquals("done", statusOn(id, yesterday))

        putJson("/api/v1/habits/$id", tracked.copy(tracking = null))
        assertEquals("missed", statusOn(id, yesterday))
        assertEquals("done", statusOn(id, today().minusDays(2)))
    }

    @Test
    fun `archived habits leave the list`() {
        val id = create(input("Read", "build")).id()
        post("/api/v1/habits/$id/archive").andExpect { status { isNoContent() } }
        assertEquals(0, getJson("/api/v1/habits").size())
        assertEquals(0, getJson("/api/v1/habits/days?from=${today()}&to=${today().plusDays(1)}").size())
    }

    @Test
    fun `today follows the caller's zone`() {
        zone = "Pacific/Kiritimati"
        val id = create(input("Read", "build")).id()
        val kiritimatiToday = today()
        addValue(id, kiritimatiToday, 1.0).andExpect { status { isNoContent() } }
        zone = "Etc/GMT+12"
        expectProblem(addValue(id, kiritimatiToday, 1.0), 422, "invalid")
    }

    @Test
    fun `habits are private to their owner`() {
        val project = project("Mine")
        val id = create(input("Read", "build")).id()
        subject = UUID.randomUUID().toString()

        assertEquals(0, getJson("/api/v1/habits").size())
        assertEquals(0, getJson("/api/v1/habits/days?from=${today()}&to=${today().plusDays(1)}").size())
        expectProblem(put("/api/v1/habits/$id", input("Stolen", "build")), 404, "notFound")
        expectProblem(post("/api/v1/habits/$id/archive"), 404, "notFound")
        expectProblem(setStatus(id, today(), ManualStatus.DONE), 404, "notFound")
        expectProblem(addValue(id, today(), 1.0), 404, "notFound")
        expectProblem(
            post("/api/v1/habits", input("Spy", "build").copy(tracking = Tracking("project", emptyList(), project))),
            404,
            "notFound",
        )
    }

    @Test
    fun `website and app habits take the values a device measured`() {
        val site =
            create(
                input("Less news", "limit").copy(tracking = Tracking("website", listOf("news.com"), null)),
            ).id()
        val plain = create(input("Read", "build")).id()
        val yesterday = today().minusDays(1)

        post("/api/v1/habits/measurements", listOf(HabitMeasurement(site, yesterday, 2.0)))
            .andExpect { status { isNoContent() } }
        val day =
            getJson("/api/v1/habits/days?from=$yesterday&to=${yesterday.plusDays(1)}")
                .values()
                .first { it.uuid("habitId") == site }
        assertEquals(2.0, day["value"].asDouble())
        assertEquals("failed", day["status"].asString())

        expectProblem(
            post("/api/v1/habits/measurements", listOf(HabitMeasurement(plain, yesterday, 1.0))),
            422,
            "invalid",
        )
        expectProblem(
            post("/api/v1/habits/measurements", listOf(HabitMeasurement(site, today().plusDays(1), 1.0))),
            422,
            "invalid",
        )
    }
}
