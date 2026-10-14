package com.skkil.time.features.time

import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TimerTest : TaskApiTest() {
    private fun now() = Instant.now().epochSecond

    private fun details(description: String = "", taskId: Long? = null) = EntryDetails(description, null, taskId)

    private fun start(details: EntryDetails) = postJson("/api/v1/timer", details)

    private fun running() = getJson("/api/v1/timer")

    private fun backdate(column: String, seconds: Long) {
        jdbc
            .sql("UPDATE running_timer SET $column = :at WHERE user_id = :user")
            .param("at", now() - seconds)
            .param("user", userId())
            .update()
    }

    private fun entryCount() =
        jdbc
            .sql("SELECT COUNT(*) FROM time_entry WHERE user_id = :user")
            .param("user", userId())
            .query(Int::class.java)
            .single()

    @Test
    fun `finishing a task stops the timer tracking it`() {
        val parent = create(input("Report")).id()
        val child = create(input("Outline").copy(parentId = parent)).id()
        val other = create(input("Email")).id()

        start(details(taskId = other))
        complete(parent)
        assertEquals(other, running()["taskId"].asLong())

        start(details(taskId = child))
        backdate("started_at", 600)
        complete(parent, false)
        assertTrue(!running().isNull)
        complete(parent)
        assertTrue(running().isNull)
        assertTrue(task(child)["trackedSeconds"].asLong() >= 600)
    }

    @Test
    fun `starting a timer finishes the previous one`() {
        start(details("first"))
        backdate("started_at", 600)
        start(details("second"))
        val entries = getJson("/api/v1/time-entries?from=${today().minusDays(1)}&to=${today().plusDays(1)}")
        assertEquals(1, entries.size())
        assertEquals("first", entries[0]["description"].asString())

        backdate("started_at", 60)
        assertEquals("second", postJson("/api/v1/timer/stop")["description"].asString())
        post("/api/v1/timer/stop").andExpect { status { isNoContent() } }
        get("/api/v1/timer").andExpect { status { isNoContent() } }
    }

    @Test
    fun `a break is left out of focus time`() {
        start(details("Write"))
        backdate("started_at", 600)
        val paused = postJson("/api/v1/timer/pause")
        assertTrue(!paused["pausedAt"].isNull)
        assertTrue(paused["bankedSeconds"].asLong() in 599..601)
        assertEquals(1, entryCount())
        assertEquals(paused, postJson("/api/v1/timer/pause"))

        backdate("paused_at", 300)
        val resumed = postJson("/api/v1/timer/resume")
        assertTrue(resumed["pausedAt"].isNull)
        assertTrue(resumed["startedAt"].asLong() >= now() - 1)
        assertTrue(resumed["bankedSeconds"].asLong() in 599..601)

        postJson("/api/v1/timer/pause")
        post("/api/v1/timer/stop").andExpect { status { isNoContent() } }
        assertTrue(running().isNull)
        assertEquals(1, entryCount())
    }

    @Test
    fun `edits, discards and restores the timer`() {
        val project = project("Thesis")
        val task = create(input("Draft", project)).id()
        expectProblem(put("/api/v1/timer", details("x")), 422, "invalid")
        expectProblem(post("/api/v1/timer/pause"), 422, "invalid")

        start(details("deep work"))
        val edited = putJson("/api/v1/timer", details("drafting", task))
        assertEquals(project, edited["projectId"].asLong())
        assertEquals(edited, running())

        val snapshot = mapper.treeToValue(edited, RunningTimer::class.java)
        expectProblem(post("/api/v1/timer/restore", snapshot), 422, "invalid")
        delete("/api/v1/timer").andExpect { status { isNoContent() } }
        assertTrue(running().isNull)
        assertEquals(edited, postJson("/api/v1/timer/restore", snapshot))
    }

    @Test
    fun `deleting the linked task keeps the timer`() {
        val task = create(input("Draft")).id()
        start(details(taskId = task))
        jdbc.sql("DELETE FROM task WHERE id = :id").param("id", task).update()
        assertTrue(running()["taskId"].isNull)
    }

    @Test
    fun `another user's timer and items stay out of reach`() {
        val project = project("Mine")
        val task = create(input("Mine", project)).id()
        start(details("mine", task))
        val me = subject
        subject = "someone-else"
        assertTrue(running().isNull)
        expectProblem(post("/api/v1/timer", details(taskId = task)), 404, "notFound")
        expectProblem(post("/api/v1/timer", EntryDetails("", project, null)), 404, "notFound")
        expectProblem(
            post("/api/v1/timer/restore", RunningTimer("", project, null, now(), null, 0)),
            404,
            "notFound",
        )
        complete(create(input("Theirs")).id())
        post("/api/v1/timer/stop").andExpect { status { isNoContent() } }
        subject = me
        assertEquals("mine", running()["description"].asString())
    }
}
