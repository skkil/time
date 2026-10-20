package com.skkil.time.features.time

import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.time.domain.EntryInput
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TimeEntryTest : TaskApiTest() {
    private fun now() = Instant.now().epochSecond

    private fun entry(taskId: UUID?, startedAt: Long, projectId: UUID? = null, description: String = "") =
        EntryInput(description, projectId, taskId, startedAt, startedAt + 600)

    private fun track(input: EntryInput) = postJson("/api/v1/time-entries", input).id()

    private fun entries(from: LocalDate, to: LocalDate) = getJson("/api/v1/time-entries?from=$from&to=$to")

    private fun subProject(name: String, parentId: UUID) =
        postJson("/api/v1/projects", ProjectInput(name, parentId, "plum")).id()

    private fun JsonNode.ids() = values().map { it.id() }

    @Test
    fun `linked task decides the project`() {
        val project = project("Thesis")
        val chapter = create(input("Chapter 2", project)).id()
        val other = project("Other")
        val now = now()
        val created = postJson("/api/v1/time-entries", EntryInput("writing", other, chapter, now - 1800, now))
        assertEquals(project, created.uuid("projectId"))
        assertEquals(1800, task(chapter)["trackedSeconds"].asLong())

        val free = putJson("/api/v1/time-entries/${created.id()}", EntryInput(" reading ", other, null, now - 60, now))
        assertEquals(other, free.uuid("projectId"))
        assertEquals("reading", free["description"].asString())
        delete("/api/v1/time-entries/${created.id()}").andExpect { status { isNoContent() } }
        expectProblem(delete("/api/v1/time-entries/${created.id()}"), 404, "notFound")
    }

    @Test
    fun `rejects backwards, overlong and future entries`() {
        val now = now()
        expectProblem(post("/api/v1/time-entries", EntryInput("", null, null, now, now - 10)), 422, "invalid")
        expectProblem(post("/api/v1/time-entries", EntryInput("", null, null, now, now + 3600)), 422, "invalid")
        expectProblem(
            post("/api/v1/time-entries", EntryInput("", null, null, now - 90_000, now)),
            422,
            "invalid",
        )
        expectProblem(
            post("/api/v1/time-entries", EntryInput("", UUID.randomUUID(), null, now - 10, now)),
            404,
            "notFound",
        )
    }

    @Test
    fun `an entry shows on every day it spans in the caller's zone`() {
        zone = "Asia/Seoul"
        val today = LocalDate.now(ZoneId.of(zone))
        val midnight = today.minusDays(1).atStartOfDay(ZoneId.of(zone)).toEpochSecond()
        postJson("/api/v1/time-entries", EntryInput("late night", null, null, midnight - 3600, midnight + 3600))
        assertEquals(1, entries(today.minusDays(2), today.minusDays(1)).size())
        assertEquals(1, entries(today.minusDays(1), today).size())
        assertEquals(0, entries(today, today.plusDays(1)).size())
        assertEquals(0, entries(today.minusDays(3), today.minusDays(2)).size())
    }

    @Test
    fun `a task lists its own and nested entries done or not`() {
        val parent = create(input("Essay")).id()
        val step = create(input("Outline").copy(parentId = parent)).id()
        val other = create(input("Other")).id()
        val own = track(entry(parent, 1_000))
        val nested = track(entry(step, 2_000))
        track(entry(other, 3_000))

        complete(parent)
        val listed = getJson("/api/v1/tasks/$parent/time-entries")
        assertEquals(listOf(nested, own), listed.ids())
        assertEquals("Outline", listed[0]["taskTitle"].asString())
        assertTrue(listed.values().all { it["taskCompleted"].asBoolean() })
    }

    @Test
    fun `a project lists its subtree and follows moved tasks`() {
        val parent = project("Parent")
        val child = subProject("Child", parent)
        val elsewhere = project("Elsewhere")
        val task = create(input("Moved", child)).id()
        val free = track(entry(null, 1_000, parent, "Reading"))
        val linked = track(entry(task, 2_000))
        assertEquals(listOf(linked, free), getJson("/api/v1/projects/$parent/time-entries").ids())

        move(task, TaskPlacement(elsewhere, null, null, null))
        assertEquals(listOf(free), getJson("/api/v1/projects/$parent/time-entries").ids())
        assertEquals(listOf(linked), getJson("/api/v1/projects/$elsewhere/time-entries").ids())
    }

    @Test
    fun `another user's entries stay out of reach`() {
        val project = project("Mine")
        val task = create(input("Mine", project)).id()
        val id = track(entry(task, 1_000))
        subject = "someone-else"
        assertEquals(0, entries(LocalDate.EPOCH, LocalDate.EPOCH.plusDays(1)).size())
        assertEquals(0, getJson("/api/v1/tasks/$task/time-entries").size())
        assertEquals(0, getJson("/api/v1/projects/$project/time-entries").size())
        expectProblem(post("/api/v1/time-entries", entry(task, 1_000)), 404, "notFound")
        expectProblem(post("/api/v1/time-entries", entry(null, 1_000, project)), 404, "notFound")
        expectProblem(put("/api/v1/time-entries/$id", entry(null, 1_000)), 404, "notFound")
        expectProblem(delete("/api/v1/time-entries/$id"), 404, "notFound")
    }
}
