package com.skkil.time.features.tasks

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class UndoTest : TaskApiTest() {
    private fun capture(vararg ids: Long) = postJson("/api/v1/undo-snapshots", TaskIds(ids.toList())).asLong()

    private fun restore(snapshot: Long) = post("/api/v1/undo-snapshots/$snapshot/restore")

    private fun count(sql: String, id: Long) = jdbc.sql(sql).param("id", id).query(Int::class.java).single()

    @Test
    fun `deleted tasks return with steps, blocks, links and history`() {
        val task = create(input("Write intro")).id()
        val step = create(input("Outline").copy(parentId = task)).id()
        val held = create(input("Send draft")).id()
        read(post("/api/v1/tasks/$held/dependencies", TaskDependency(task)))
        val user = userId()
        val start = 1_793_577_600L
        jdbc
            .sql("INSERT INTO time_block (user_id, task_id, start_at, end_at) VALUES (:user, :task, :start, :end)")
            .param("user", user)
            .param("task", task)
            .param("start", start)
            .param("end", start + 3600)
            .update()
        val entry =
            jdbc
                .sql(
                    """
                    INSERT INTO time_entry (user_id, task_id, started_at, ended_at)
                    VALUES (:user, :task, :start, :end) RETURNING id
                    """,
                ).param("user", user)
                .param("task", task)
                .param("start", start)
                .param("end", start + 600)
                .query(Long::class.java)
                .single()

        val snapshot = capture(task)
        delete("/api/v1/tasks/$task").andExpect { status { isNoContent() } }
        expectProblem(get("/api/v1/tasks/$step"), 404, "notFound")

        restore(snapshot).andExpect { status { isNoContent() } }

        assertEquals("Write intro", task(task)["title"].asString())
        assertEquals(task, task(step).longOrNull("parentId"))
        assertEquals(listOf(task), task(held).longs("blockedBy"))
        assertEquals(1, count("SELECT COUNT(*) FROM time_block WHERE task_id = :id", task))
        assertEquals(
            task,
            jdbc.sql(
                "SELECT task_id FROM time_entry WHERE id = :id",
            ).param("id", entry).query(Long::class.java).single(),
        )
        assertEquals(600, task(task)["trackedSeconds"].asLong())
    }

    @Test
    fun `undoing done reopens steps and rewinds a repeat`() {
        val parent = create(input("Pack")).id()
        val step = create(input("Socks").copy(parentId = parent)).id()
        val snapshot = capture(parent)
        complete(parent)
        read(restore(snapshot))
        assertTrue(task(parent)["completedAt"].isNull)
        assertTrue(task(step)["completedAt"].isNull)

        val repeat = create(input("Water plants").copy(dueDate = today(), recurrence = "every day"))
        val due = repeat["dueDate"].asString()
        val again = capture(repeat.id())
        complete(repeat.id())
        assertNotEquals(due, task(repeat.id())["dueDate"].asString())
        read(restore(again))
        assertEquals(due, task(repeat.id())["dueDate"].asString())
    }

    @Test
    fun `refuses to overwrite a task that reused the id`() {
        val id = create(input("Old")).id()
        val snapshot = capture(id)
        delete("/api/v1/tasks/$id")
        jdbc
            .sql(
                "INSERT INTO task (id, user_id, title, created_at) OVERRIDING SYSTEM VALUE VALUES (:id, :user, 'New', 1)",
            )
            .param("id", id)
            .param("user", userId())
            .update()
        expectProblem(restore(snapshot), 422, "invalid")
        assertEquals("New", task(id)["title"].asString())
    }

    @Test
    fun `refuses when the project is gone`() {
        val project = project("Gone")
        val id = create(input("Orphan", project)).id()
        val snapshot = capture(id)
        delete("/api/v1/projects/$project")
        restore(snapshot).andExpect {
            jsonPath("$.detail") { value("Its project or section is gone, so this can't be undone.") }
        }
    }

    @Test
    fun `keeps only recent snapshots and each restores once`() {
        val first = capture()
        repeat(50) { capture() }
        expectProblem(restore(first), 422, "invalid")
        val last = capture()
        read(restore(last))
        expectProblem(restore(last), 422, "invalid")
    }

    @Test
    fun `restores only the caller's own snapshots`() {
        val id = create(input("Mine")).id()
        val snapshot = capture(id)
        subject = UUID.randomUUID().toString()
        expectProblem(restore(snapshot), 422, "invalid")
        assertEquals(1, count("SELECT COUNT(*) FROM undo_snapshot WHERE id = :id", snapshot))
        val empty = capture(id)
        delete("/api/v1/tasks/$id")
        read(restore(empty))
    }
}
