package com.skkil.time.features.rituals

import com.skkil.time.common.error.DomainException
import com.skkil.time.common.web.Caller
import com.skkil.time.features.rituals.api.PlanningChoice
import com.skkil.time.features.rituals.api.RitualStep
import com.skkil.time.features.rituals.api.RitualTask
import com.skkil.time.features.rituals.domain.Moment
import com.skkil.time.features.rituals.domain.RitualEvent
import com.skkil.time.features.rituals.domain.RitualInput
import com.skkil.time.features.rituals.service.RitualService
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RitualTest : TaskApiTest() {
    @Autowired lateinit var rituals: RitualService

    private fun caller() = Caller(userId(), scopeId(), ZoneOffset.UTC)

    private fun moment(day: String, minute: Int): Moment {
        val date = LocalDate.parse(day)
        return Moment(date, minute, date.atStartOfDay(ZoneOffset.UTC).toEpochSecond() + minute * 60L)
    }

    private fun due(at: Moment, event: RitualEvent): String? = asServer { rituals.due(caller(), at, event) }?.kind

    private fun disable(vararg kinds: String) {
        kinds.forEach { kind ->
            asServer {
                jdbc
                    .sql("UPDATE ritual SET enabled = FALSE WHERE user_id = :user AND kind = :kind")
                    .param("user", userId())
                    .param("kind", kind)
                    .update()
            }
        }
    }

    private fun ritual(kind: String) = getJson("/api/v1/rituals").values().first { it["kind"].asString() == kind }

    private fun steps(kind: String) = ritual(kind)["steps"].values().map { it.asString() }

    @Test
    fun `seeds five templates`() {
        val list = getJson("/api/v1/rituals").values().map { it["kind"].asString() }
        assertEquals(listOf("weekly", "morning", "evening", "wind_down", "session"), list)
        assertTrue(ritual("session")["enabled"].asBoolean())
        assertEquals("did_it_move", steps("session")[0])
        assertEquals(listOf("what_moved", "leftovers", "habit_check", "one_line_note"), steps("evening"))
        assertTrue(getJson("/api/v1/planning-time")["time"].isNull)
    }

    @Test
    fun `choosing evening turns morning off`() {
        put("/api/v1/planning-time", PlanningChoice("morning"))
        val list = putJson("/api/v1/planning-time", PlanningChoice("evening"))
        assertEquals(5, list.size())
        assertFalse(ritual("morning")["enabled"].asBoolean())
        assertTrue(ritual("evening")["enabled"].asBoolean())
        assertEquals("evening", getJson("/api/v1/planning-time")["time"].asString())
        put("/api/v1/planning-time", PlanningChoice("noon")).andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("Plan in the morning or the evening.") }
        }
    }

    @Test
    fun `morning runs once on first open`() {
        disable("weekly")
        asServer { rituals.setPlanningTime(caller(), "morning") }
        val at = moment("2026-11-03", 8 * 60)
        assertEquals("morning", due(at, RitualEvent.Open))
        val started = asServer { rituals.start(caller(), "morning", at, null) }
        assertNull(due(at, RitualEvent.Tick))

        asServer { rituals.snooze(userId(), started.id, at.stamp) }
        val error = assertThrows<DomainException> { asServer { rituals.snooze(userId(), started.id, at.stamp) } }
        assertEquals("This ritual was already snoozed once.", error.message)
        val later = moment("2026-11-03", 8 * 60 + 16)
        assertEquals("morning", due(later, RitualEvent.Tick))
        asServer { rituals.skip(userId(), started.id) }
        assertNull(due(later, RitualEvent.Tick))
        assertEquals(started.id, asServer { rituals.start(caller(), "morning", later, null) }.id)
    }

    @Test
    fun `evening follows the clock or the last block`() {
        disable("weekly")
        asServer { rituals.setPlanningTime(caller(), "evening") }
        val day = "2026-11-03"
        assertNull(due(moment(day, 16 * 60), RitualEvent.Tick))
        val task = create(input("Write")).id()
        asServer {
            jdbc
                .sql(
                    "INSERT INTO time_block (id, user_id, task_id, start_at, end_at) VALUES (gen_random_uuid(), :user, :task, :from, :to)",
                )
                .param("user", userId())
                .param("task", task)
                .param("from", moment(day, 14 * 60).stamp)
                .param("to", moment(day, 15 * 60 + 30).stamp)
                .update()
        }
        assertEquals("evening", due(moment(day, 16 * 60), RitualEvent.Tick))
        assertEquals("evening", due(moment("2026-11-04", 17 * 60 + 30), RitualEvent.Tick))
    }

    @Test
    fun `session close needs a long enough timer`() {
        disable("weekly")
        val at = moment("2026-11-03", 10 * 60)
        assertNull(due(at, RitualEvent.TimerStopped(12)))
        assertEquals("session", due(at, RitualEvent.TimerStopped(25)))
        val first = asServer { rituals.start(caller(), "session", at, null) }
        asServer { rituals.finish(userId(), first.id, at.stamp) }
        assertNotEquals(first.id, asServer { rituals.start(caller(), "session", at, null) }.id)
    }

    @Test
    fun `weekly waits for its day and an unreviewed week`() {
        val monday = moment("2026-11-02", 9 * 60)
        val tuesday = moment("2026-11-03", 9 * 60)
        assertEquals("weekly", due(monday, RitualEvent.Open))
        assertNull(due(tuesday, RitualEvent.Open))
        asServer {
            jdbc
                .sql(
                    "INSERT INTO week (id, user_id, start_date, reviewed_at) VALUES (gen_random_uuid(), :user, '2026-10-26', 1)",
                )
                .param("user", userId())
                .update()
        }
        assertNull(due(monday, RitualEvent.Open))
    }

    @Test
    fun `validates steps and triggers`() {
        fun input(trigger: String, vararg steps: String) = RitualInput(true, trigger, 1050, 127, steps.toList())

        fun rejects(kind: String, input: RitualInput, message: String) =
            put("/api/v1/rituals/$kind", input).andExpect {
                status { isEqualTo(422) }
                jsonPath("$.detail") { value(message) }
            }
        rejects("evening", input("at_time", "feel", "nope"), "Unknown step: nope")
        rejects("evening", input("at_time"), "Keep at least one step.")
        rejects("evening", input("after_timer_stop", "feel"), "Only the session ritual follows the timer.")
        rejects("evening", input("at_time", "feel", "feel"), "Each step appears once.")
        rejects("evening", input("soon", "feel"), "Unknown trigger: soon")
        rejects("evening", input("at_time", "feel").copy(atMinute = 1440), "Time must be within the day.")
        rejects("evening", input("at_time", "feel").copy(weekdays = 0), "Pick at least one day.")
        expectProblem(put("/api/v1/rituals/nightly", input("at_time", "feel")), 404, "notFound")

        val evening = putJson("/api/v1/rituals/evening", input("at_time", "one_line_note", "feel"))
        assertEquals(listOf("one_line_note", "feel"), evening["steps"].values().map { it.asString() })
        val weekly = putJson("/api/v1/rituals/weekly", input("first_open", "feel"))
        assertEquals(listOf("weekly_review"), weekly["steps"].values().map { it.asString() })
    }

    @Test
    fun `runs over http`() {
        disable("weekly", "morning", "evening", "wind_down")
        post("/api/v1/rituals/due", RitualEvent.Open).andExpect { status { isNoContent() } }
        assertEquals("session", postJson("/api/v1/rituals/due", RitualEvent.TimerStopped(25))["kind"].asString())

        val task = create(input("Write")).id()
        val run = postJson("/api/v1/rituals/session/runs", RitualTask(task))
        assertEquals(task, run.uuidOrNull("taskId"))
        val id = run.id()
        assertEquals(2, putJson("/api/v1/ritual-runs/$id/step", RitualStep(2))["step"].asInt())
        assertEquals(2, putJson("/api/v1/ritual-runs/$id/step", RitualStep(1))["step"].asInt())
        assertTrue(!postJson("/api/v1/ritual-runs/$id/snooze")["snoozedUntil"].isNull)
        expectProblem(post("/api/v1/ritual-runs/$id/snooze"), 422, "invalid")
        assertTrue(postJson("/api/v1/ritual-runs/$id/skip")["skipped"].asBoolean())
        val finished = postJson("/api/v1/ritual-runs/$id/finish")["finishedAt"].asLong()
        assertEquals(finished, postJson("/api/v1/ritual-runs/$id/finish")["finishedAt"].asLong())
        expectProblem(post("/api/v1/ritual-runs/$id/skip"), 404, "notFound")

        val today = run["date"].asString()
        val runs = getJson("/api/v1/ritual-runs?from=$today&to=${LocalDate.parse(today).plusDays(1)}")
        assertEquals(listOf(id), runs.values().map { it.id() })
    }

    @Test
    fun `another user can't see or touch rituals`() {
        val task = create(input("Write")).id()
        val run = postJson("/api/v1/rituals/morning/runs", RitualTask(null)).id()
        put("/api/v1/planning-time", PlanningChoice("evening"))

        subject = UUID.randomUUID().toString()
        assertTrue(getJson("/api/v1/planning-time")["time"].isNull)
        assertFalse(ritual("evening")["enabled"].asBoolean())
        assertTrue(getJson("/api/v1/ritual-runs?from=2000-01-01&to=2100-01-01").isEmpty)
        expectProblem(post("/api/v1/rituals/session/runs", RitualTask(task)), 404, "notFound")
        expectProblem(put("/api/v1/ritual-runs/$run/step", RitualStep(1)), 404, "notFound")
        expectProblem(post("/api/v1/ritual-runs/$run/finish"), 404, "notFound")
        expectProblem(post("/api/v1/ritual-runs/$run/skip"), 404, "notFound")
        expectProblem(post("/api/v1/ritual-runs/$run/snooze"), 404, "notFound")
    }
}
