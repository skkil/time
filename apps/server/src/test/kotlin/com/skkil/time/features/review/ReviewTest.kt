package com.skkil.time.features.review

import com.skkil.time.features.tasks.TaskApiTest
import com.skkil.time.features.tasks.TaskOutcome
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ReviewTest : TaskApiTest() {
    private val monday = LocalDate.parse("2026-11-02")

    private fun week(date: LocalDate): JsonNode = getJson("/api/v1/weeks/$date")

    private fun outcomes(date: LocalDate) = week(date)["outcomes"].values().toList()

    private fun addOutcome(date: LocalDate, title: String, priorityId: Long? = null) =
        post("/api/v1/weeks/$date/outcomes", OutcomeInput(title, priorityId))

    private fun setStatus(id: Long, status: OutcomeStatus) =
        put("/api/v1/outcomes/$id/status", OutcomeStatusInput(status))

    private fun quarter(label: String, start: String) =
        postJson("/api/v1/quarters", QuarterInput(label, LocalDate.parse(start))).asLong()

    private fun weekNo(date: String): Int? =
        read(get("/api/v1/quarter?date=$date")).takeUnless { it.isNull }?.get("weekNo")?.asInt()

    private fun startOf(date: LocalDate) = date.atStartOfDay(ZoneOffset.UTC).toEpochSecond()

    @Test
    fun `numbers weeks inside the quarter`() {
        quarter("2026 Q4", "2026-09-30")
        assertEquals(1, weekNo("2026-09-28"))
        assertEquals(5, weekNo("2026-11-01"))
        assertEquals(13, weekNo("2026-12-27"))
        assertNull(weekNo("2026-12-28"))
        assertNull(weekNo("2026-09-27"))
        get("/api/v1/quarter?date=2026-12-28").andExpect { status { isNoContent() } }
    }

    @Test
    fun `caps open outcomes at three`() {
        listOf("A", "B", "C").forEach { addOutcome(monday, it).andExpect { status { isNoContent() } } }
        addOutcome(monday.plusDays(3), "D").andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("3 outcomes max. Finish or drop one first.") }
        }

        val first = outcomes(monday)[0].id()
        setStatus(first, OutcomeStatus.ACHIEVED).andExpect { status { isNoContent() } }
        addOutcome(monday, "D").andExpect { status { isNoContent() } }
        expectProblem(setStatus(first, OutcomeStatus.OPEN), 422, "invalid")
    }

    @Test
    fun `carrying moves open tasks and undoing moves them back`() {
        addOutcome(monday, "Ship beta")
        val outcome = outcomes(monday)[0].id()
        val done = create(input("Write docs")).id()
        val open = create(input("Fix login")).id()
        put("/api/v1/tasks/$done/outcome", TaskOutcome(outcome))
        put("/api/v1/tasks/$open/outcome", TaskOutcome(outcome))
        complete(done)

        val evidence = outcomes(monday)[0]
        assertEquals(1 to 2, evidence["tasksDone"].asInt() to evidence["tasksTotal"].asInt())

        setStatus(outcome, OutcomeStatus.CARRIED)
        val next = outcomes(monday.plusDays(7))[0]
        assertEquals(outcome, next.longOrNull("carriedFrom"))
        assertEquals(next.id(), task(open).longOrNull("outcomeId"))
        assertEquals(outcome, task(done).longOrNull("outcomeId"))

        setStatus(outcome, OutcomeStatus.ACHIEVED)
        assertTrue(outcomes(monday.plusDays(7)).isEmpty())
        assertEquals(outcome, task(open).longOrNull("outcomeId"))

        setStatus(outcome, OutcomeStatus.CARRIED)
        val second = outcomes(monday.plusDays(7))[0].id()
        setStatus(second, OutcomeStatus.CARRIED)
        val third = outcomes(monday.plusDays(14))[0]
        assertEquals(2, third["timesCarried"].asInt())
        setStatus(third.id(), OutcomeStatus.CARRIED).andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("Carried twice already. Shrink it, give it a new date, or drop it.") }
        }
    }

    @Test
    fun `tracks week review progress`() {
        put("/api/v1/weeks/$monday/felt", Felt(3)).andExpect { status { isNoContent() } }
        put("/api/v1/weeks/$monday/step", ReviewStep(2))
        put("/api/v1/weeks/$monday/step", ReviewStep(1))
        assertEquals(2, week(monday)["step"].asInt())
        assertTrue(week(monday)["reviewedAt"].isNull)
        expectProblem(put("/api/v1/weeks/$monday/step", ReviewStep(7)), 422, "invalid")
        post("/api/v1/weeks/${monday.plusDays(2)}/finish").andExpect { status { isNoContent() } }

        val summary = getJson("/api/v1/weeks?from=$monday&to=${monday.plusDays(7)}")[0]
        assertEquals(3, summary["felt"].asInt())
        assertEquals(6, summary["step"].asInt())
        assertNotNull(summary["reviewedAt"].takeUnless { it.isNull })
    }

    @Test
    fun `saves week notes`() {
        put("/api/v1/weeks/${monday.plusDays(4)}/notes", WeekNotes(" Shipped ", "Sleep", "Earlier nights"))
            .andExpect { status { isNoContent() } }
        val notes = week(monday)["notes"]
        assertEquals("Shipped", notes["worked"].asString())
        assertEquals("Sleep", notes["fellShort"].asString())
        assertEquals("Earlier nights", notes["change"].asString())
        expectProblem(put("/api/v1/weeks/$monday/notes", WeekNotes("x".repeat(2_001), "", "")), 422, "invalid")
    }

    @Test
    fun `summarises tracked and planned time by start`() {
        val user = userId()
        val task = create(input("Write")).id()
        val start = startOf(monday)

        fun entry(from: Long, to: Long) =
            jdbc
                .sql("INSERT INTO time_entry (user_id, started_at, ended_at) VALUES (:user, :from, :to)")
                .param("user", user)
                .param("from", from)
                .param("to", to)
                .update()
        entry(start - 1800, start + 1800)
        entry(start + 3600, start + 5400)
        jdbc
            .sql("INSERT INTO time_block (user_id, task_id, start_at, end_at) VALUES (:user, :task, :from, :to)")
            .param("user", user)
            .param("task", task)
            .param("from", start + 7200)
            .param("to", start + 14400)
            .update()
        create(input("Call the bank").copy(dueDate = monday.plusDays(2), dueTime = 600, estimateMinutes = 30))

        val summaries = getJson("/api/v1/weeks?from=${monday.minusDays(7)}&to=${monday.plusDays(7)}").values().toList()
        assertEquals(2, summaries.size)
        assertEquals(monday.toString(), summaries[0]["startDate"].asString())
        assertEquals(1800, summaries[0]["trackedSeconds"].asLong())
        assertEquals(7200L + 1800, summaries[0]["plannedSeconds"].asLong())
        assertEquals(3600, summaries[1]["trackedSeconds"].asLong())
        assertTrue(summaries[1]["reviewedAt"].isNull)
    }

    @Test
    fun `rates past days only`() {
        val today = today()
        post("/api/v1/days/$today/skip").andExpect { status { isNoContent() } }
        put("/api/v1/days/$today/felt", Felt(4)).andExpect { status { isNoContent() } }
        put("/api/v1/days/$today/note", DayNote("steady")).andExpect { status { isNoContent() } }
        put("/api/v1/days/${today.plusDays(1)}/felt", Felt(4)).andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("That day hasn't happened yet.") }
        }
        put("/api/v1/days/$today/felt", Felt(6)).andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("Rate it from 1 to 5.") }
        }
        val day = getJson("/api/v1/days?from=$today&to=${today.plusDays(1)}")[0]
        assertEquals(4, day["felt"].asInt())
        assertEquals("steady", day["note"].asString())
        assertEquals(false, day["skipped"].asBoolean())
    }

    @Test
    fun `quarter priorities count achieved outcomes`() {
        val id = quarter("2026 Q4", "2026-09-28")
        listOf("Health", "Ship", "Family").forEach {
            post("/api/v1/quarters/$id/priorities", PriorityTitle(it)).andExpect { status { isNoContent() } }
        }
        post("/api/v1/quarters/$id/priorities", PriorityTitle("More")).andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("3 priorities max. Remove one first.") }
        }
        val ship = getJson("/api/v1/quarter?date=$monday")["priorities"][1].id()
        addOutcome(monday, "Beta out", ship)
        setStatus(outcomes(monday)[0].id(), OutcomeStatus.ACHIEVED)
        put("/api/v1/priorities/$ship", PriorityInput("Ship v1", "Beta first")).andExpect { status { isNoContent() } }

        val priority = getJson("/api/v1/quarter?date=$monday")["priorities"][1]
        assertEquals("Ship v1", priority["title"].asString())
        assertEquals("Beta first", priority["note"].asString())
        assertEquals(1, priority["achieved"].asInt())

        assertEquals(id, putJson("/api/v1/quarters/$id", QuarterInput("Q4", LocalDate.parse("2026-10-01"))).asLong())
        assertEquals("2026-09-28", getJson("/api/v1/quarter?date=$monday")["startDate"].asString())
        delete("/api/v1/priorities/$ship").andExpect { status { isNoContent() } }
        assertTrue(outcomes(monday)[0]["priorityId"].isNull)
        expectProblem(delete("/api/v1/priorities/$ship"), 404, "notFound")
    }

    @Test
    fun `another user can't see or touch review data`() {
        val quarter = quarter("2026 Q4", "2026-09-28")
        post("/api/v1/quarters/$quarter/priorities", PriorityTitle("Health"))
        val priority = getJson("/api/v1/quarter?date=$monday")["priorities"][0].id()
        addOutcome(monday, "Run 3x", priority)
        put("/api/v1/weeks/$monday/felt", Felt(4))
        put("/api/v1/days/$monday/note", DayNote("ok"))
        val outcome = outcomes(monday)[0].id()

        subject = UUID.randomUUID().toString()
        assertTrue(outcomes(monday).isEmpty())
        assertTrue(week(monday)["felt"].isNull)
        assertTrue(getJson("/api/v1/days?from=$monday&to=${monday.plusDays(1)}").isEmpty)
        get("/api/v1/quarter?date=$monday").andExpect { status { isNoContent() } }
        expectProblem(setStatus(outcome, OutcomeStatus.DROPPED), 404, "notFound")
        expectProblem(put("/api/v1/outcomes/$outcome", OutcomeInput("Mine", null)), 404, "notFound")
        expectProblem(delete("/api/v1/outcomes/$outcome"), 404, "notFound")
        expectProblem(addOutcome(monday, "Borrowed", priority), 404, "notFound")
        expectProblem(post("/api/v1/quarters/$quarter/priorities", PriorityTitle("Mine")), 404, "notFound")
        expectProblem(put("/api/v1/quarters/$quarter", QuarterInput("Mine", monday)), 404, "notFound")
        expectProblem(put("/api/v1/priorities/$priority", PriorityInput("Mine", "")), 404, "notFound")
        expectProblem(delete("/api/v1/priorities/$priority"), 404, "notFound")
    }
}
