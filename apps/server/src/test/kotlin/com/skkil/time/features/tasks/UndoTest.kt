package com.skkil.time.features.tasks

import com.skkil.time.features.tasks.api.TaskDependency
import com.skkil.time.features.tasks.api.TaskIds
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class UndoTest : TaskApiTest() {
    private fun capture(vararg ids: UUID): JsonNode = postJson("/api/v1/undo/capture", TaskIds(ids.toList()))

    private fun restore(snapshot: JsonNode) = post("/api/v1/undo/restore", snapshot)

    private fun count(sql: String, id: UUID) = jdbc.sql(sql).param("id", id).query(Int::class.java).single()

    @Test
    fun `deleted tasks return with steps, blocks, links and history`() {
        val task = create(input("Write intro")).id()
        val step = create(input("Outline").copy(parentId = task)).id()
        val held = create(input("Send draft")).id()
        read(post("/api/v1/tasks/$held/dependencies", TaskDependency(task)))
        val user = userId()
        val start = 1_793_577_600L
        asServer {
            jdbc
                .sql(
                    "INSERT INTO time_block (id, user_id, task_id, start_at, end_at) VALUES (gen_random_uuid(), :user, :task, :start, :end)",
                )
                .param("user", user)
                .param("task", task)
                .param("start", start)
                .param("end", start + 3600)
                .update()
        }
        val entry =
            asServer {
                jdbc
                    .sql(
                        """
                    INSERT INTO time_entry (id, user_id, task_id, started_at, ended_at)
                    VALUES (gen_random_uuid(), :user, :task, :start, :end) RETURNING id
                    """,
                    ).param("user", user)
                    .param("task", task)
                    .param("start", start)
                    .param("end", start + 600)
                    .query(UUID::class.java)
                    .single()
            }

        val snapshot = capture(task)
        delete("/api/v1/tasks/$task").andExpect { status { isNoContent() } }
        expectProblem(get("/api/v1/tasks/$step"), 404, "notFound")

        restore(snapshot).andExpect { status { isNoContent() } }

        assertEquals("Write intro", task(task)["title"].asString())
        assertEquals(task, task(step).uuidOrNull("parentId"))
        assertEquals(listOf(task), task(held).uuids("blockedBy"))
        assertEquals(1, count("SELECT COUNT(*) FROM time_block WHERE task_id = :id", task))
        assertEquals(
            task,
            jdbc.sql(
                "SELECT task_id FROM time_entry WHERE id = :id",
            ).param("id", entry).query(UUID::class.java).single(),
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
        asServer {
            jdbc
                .sql(
                    "INSERT INTO task (id, user_id, title, created_at) VALUES (:id, :user, 'New', 1)",
                )
                .param("id", id)
                .param("user", userId())
                .update()
        }
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
    fun `a snapshot is plain data in the shape time-core keeps`() {
        val task = create(input("Write")).id()
        val held = create(input("Send")).id()
        read(post("/api/v1/tasks/$held/dependencies", TaskDependency(task)))
        val snapshot = capture(task)

        assertEquals(listOf("copies", "created", "dependencies", "links", "tasks"), snapshot.propertyNames().sorted())
        assertEquals("task", snapshot["tasks"]["table"].asString())
        val columns = snapshot["tasks"]["columns"].values().map { it.asString() }
        assertTrue("title" in columns && "user_id" !in columns && "reminded_for" !in columns)
        assertEquals("Write", snapshot["tasks"]["values"][0][columns.indexOf("title")].asString())
        assertEquals(task.toString(), snapshot["created"][0][0].asString())
        assertTrue(snapshot["created"][0][1].isIntegralNumber)
        assertEquals(listOf("time_block", "record_phase"), snapshot["copies"].values().map { it["table"].asString() })
        assertEquals(
            listOf(held.toString(), task.toString()),
            snapshot["dependencies"][0].values().map {
                it.asString()
            },
        )
    }

    @Test
    fun `a snapshot never writes into another account`() {
        val id = create(input("Mine")).id()
        val snapshot = capture(id)
        subject = UUID.randomUUID().toString()
        expectProblem(restore(snapshot), 422, "invalid")

        val project = project("Theirs")
        subject = UUID.randomUUID().toString()
        val own = create(input("Moved")).id()
        val stolen = capture(own)
        val columns = stolen["tasks"]["columns"].values().map { it.asString() }
        (stolen["tasks"]["values"][0] as tools.jackson.databind.node.ArrayNode)
            .set(columns.indexOf("project_id"), mapper.valueToTree<JsonNode>(project.toString()))
        expectProblem(restore(stolen), 422, "invalid")
        assertTrue(task(own)["projectId"].isNull)
    }
}
