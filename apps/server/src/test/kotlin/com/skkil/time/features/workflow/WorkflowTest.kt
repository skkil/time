package com.skkil.time.features.workflow

import com.skkil.time.features.tasks.api.TaskCompleted
import com.skkil.time.features.tasks.api.TaskDependency
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.workflow.api.MilestoneLabel
import com.skkil.time.features.workflow.api.PresetText
import com.skkil.time.features.workflow.api.StatusPlacement
import com.skkil.time.features.workflow.api.TaskEventDetails
import com.skkil.time.features.workflow.api.TaskMilestoneId
import com.skkil.time.features.workflow.api.TaskStatusId
import com.skkil.time.features.workflow.api.TaskTypeId
import com.skkil.time.features.workflow.domain.ItemTypeInput
import com.skkil.time.features.workflow.domain.MilestoneInput
import com.skkil.time.features.workflow.domain.PRESETS
import com.skkil.time.features.workflow.domain.Preset
import com.skkil.time.features.workflow.domain.StatusInput
import com.skkil.time.features.workflow.domain.ViewInput
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WorkflowTest : TaskApiTest() {
    private fun preset(key: String) = PRESETS.first { it.key == key }

    private fun apply(project: UUID, preset: Preset) =
        put("/api/v1/projects/$project/preset", preset).andExpect { status { isNoContent() } }

    private fun workflow(): JsonNode = getJson("/api/v1/workflow")

    private fun idOf(list: String, project: UUID, name: String): UUID =
        workflow()[list].values().first {
            it.uuid("projectId") == project && it["name"].asString() == name
        }.id()

    private fun setStatus(task: UUID, status: UUID) = putJson("/api/v1/tasks/$task/status", TaskStatusId(status))

    private fun setType(task: UUID, type: UUID?) = put("/api/v1/tasks/$task/type", TaskTypeId(type))

    private fun d(value: String) = LocalDate.parse(value)

    private fun start(date: String) = d(date).atStartOfDay().toEpochSecond(ZoneOffset.UTC)

    @Test
    fun `simple projects get no structure`() {
        val id = project("Plain")
        apply(id, preset("simple"))
        val task = create(input("Write", id))
        assertTrue(task["statusId"].isNull)
        assertEquals("task", task["kind"].asString())
        assertTrue(workflow()["types"].isEmpty && workflow()["statuses"].isEmpty)
        assertEquals(6, getJson("/api/v1/presets").size())
    }

    @Test
    fun `presets give new and existing tasks a status`() {
        val id = project("App")
        val old = create(input("Old", id)).id()
        val done = create(input("Shipped", id)).id()
        complete(done)
        apply(id, preset("software"))

        assertEquals("todo", task(old).textOrNull("statusCategory"))
        assertEquals("done", task(done).textOrNull("statusCategory"))
        assertEquals("todo", create(input("New", id)).textOrNull("statusCategory"))
        assertEquals(4, workflow()["views"].size())
        assertEquals("software", getJson("/api/v1/projects").first()["preset"].asString())
    }

    @Test
    fun `statuses and completion stay in step`() {
        val id = project("App")
        apply(id, preset("software"))
        val by = { name: String -> idOf("statuses", id, name) }
        val task = create(input("Login", id)).id()

        val review = setStatus(task, by("In review"))
        assertTrue(review["completedAt"].isNull)
        assertFalse(review["statusChangedAt"].isNull)
        assertFalse(setStatus(task, by("Canceled"))["completedAt"].isNull)

        assertEquals("todo", complete(task, false).textOrNull("statusCategory"))
        assertEquals(by("Done"), complete(task).uuidOrNull("statusId"))

        expectProblem(delete("/api/v1/item-statuses/${by("Done")}"), 422, "invalid")
        delete("/api/v1/item-statuses/${by("Done")}?replacement=${by("Canceled")}").andExpect {
            status { isNoContent() }
        }
        assertEquals(by("Canceled"), task(task).uuidOrNull("statusId"))

        put("/api/v1/item-statuses/${by("Canceled")}", StatusInput("Canceled", "todo"))
        assertTrue(task(task)["completedAt"].isNull)
    }

    @Test
    fun `moving to another project maps type and status`() {
        val a = project("A")
        val b = project("B")
        apply(a, preset("software"))
        apply(b, preset("software"))
        val task = create(input("Crash", a)).id()
        read(setType(task, idOf("types", a, "Bug")))
        val moved = move(task, TaskPlacement(b, null, null, null))
        assertEquals(idOf("types", b, "Bug"), moved.uuidOrNull("typeId"))
        assertEquals("todo", moved.textOrNull("statusCategory"))

        val inbox = move(task, TaskPlacement(null, null, null, null))
        assertNull(inbox.uuidOrNull("typeId"))
        assertNull(inbox.uuidOrNull("statusId"))
    }

    @Test
    fun `types add their checklist and events need a time`() {
        val id = project("Course")
        val course = preset("course")
        apply(
            id,
            course.copy(
                types =
                    course.types.mapIndexed { i, t ->
                        if (i ==
                            1
                        ) {
                            t.copy(checklist = "Skim\nTake notes\n")
                        } else {
                            t
                        }
                    },
            ),
        )
        val reading = idOf("types", id, "Reading")
        val lecture = idOf("types", id, "Lecture")

        val chapter = create(input("Chapter 3", id)).id()
        read(setType(chapter, reading))
        assertEquals(2, getJson("/api/v1/tasks").values().count { it.uuidOrNull("parentId") == chapter })

        val talk = create(input("Lecture 1", id)).id()
        expectProblem(setType(talk, lecture), 422, "invalid")
        putJson(
            "/api/v1/tasks/$talk",
            input("Lecture 1", id).copy(dueDate = d("2026-11-02"), dueTime = 600, recurrence = "every monday"),
        )
        val event = read(setType(talk, lecture))
        assertEquals("event", event["kind"].asString())
        assertEquals(90, event["estimateMinutes"].asInt())
        expectProblem(put("/api/v1/tasks/$talk/completed", TaskCompleted(true)), 422, "invalid")
        expectProblem(put("/api/v1/tasks/$talk", input("Lecture 1", id)), 422, "invalid")
        expectProblem(post("/api/v1/tasks/$chapter/dependencies", TaskDependency(talk)), 422, "invalid")

        val events = getJson("/api/v1/events?from=2026-11-02&to=2026-11-23").values().toList()
        assertEquals(3, events.size)
        assertEquals(start("2026-11-09") + 10 * 3600, events[1]["startAt"].asLong())
        assertEquals(90L * 60, events[0]["endAt"].asLong() - events[0]["startAt"].asLong())
    }

    @Test
    fun `time by type adds tracked time and counted events`() {
        val id = project("Course")
        apply(id, preset("course"))
        val reading = create(input("Chapter", id)).id()
        read(setType(reading, idOf("types", id, "Reading")))
        jdbc
            .sql(
                "INSERT INTO time_entry (id, user_id, task_id, started_at, ended_at) VALUES (gen_random_uuid(), :user, :task, :start, :end)",
            )
            .param("user", userId())
            .param("task", reading)
            .param("start", start("2026-11-03"))
            .param("end", start("2026-11-03") + 1800)
            .update()
        val talk = create(input("Lecture", id).copy(dueDate = d("2026-11-02"), dueTime = 540)).id()
        read(setType(talk, idOf("types", id, "Lecture")))
        putJson("/api/v1/tasks/$talk/event-details", TaskEventDetails(" Hall B ", true))

        val totals = getJson("/api/v1/time-by-type?from=2026-11-02&to=2026-11-09").values().toList()
        assertEquals(listOf("Lecture", "Reading"), totals.map { it["name"].asString() })
        assertEquals(listOf(5400L, 1800L), totals.map { it["seconds"].asLong() })
        assertEquals("Hall B", task(talk)["location"].asString())
    }

    @Test
    fun `presets round trip through a file`() {
        val id = project("Job hunt")
        apply(id, preset("pipeline"))
        val exported = getJson("/api/v1/projects/$id/preset")
        assertEquals("custom-job-hunt", exported["key"].asString())
        val parsed = postJson("/api/v1/presets/read", PresetText(mapper.writeValueAsString(exported)))
        assertEquals(5, parsed["statuses"].size())
        post("/api/v1/presets/read", PresetText("{}")).andExpect {
            jsonPath("$.detail") { value("That file isn't a skkil time preset.") }
        }
    }

    @Test
    fun `edits types, statuses, milestones and views`() {
        val id = project("App")
        val type =
            postJson(
                "/api/v1/projects/$id/item-types",
                ItemTypeInput(" Spike ", "nope", "task", null, ""),
            ).asUuid()
        expectProblem(
            post("/api/v1/projects/$id/item-types", ItemTypeInput("Odd", "circle", "thing", null, "")),
            422,
            "invalid",
        )
        put("/api/v1/item-types/$type", ItemTypeInput("Spike", "flag", "task", 45, "")).andExpect {
            status { isNoContent() }
        }
        val first = postJson("/api/v1/projects/$id/item-statuses", StatusInput("Todo", "todo")).asUuid()
        val second = postJson("/api/v1/projects/$id/item-statuses", StatusInput("Done", "done")).asUuid()
        put("/api/v1/item-statuses/$second/position", StatusPlacement(first))
        val milestone = postJson("/api/v1/projects/$id/milestones", MilestoneInput("v1", d("2026-12-01"))).asUuid()
        put("/api/v1/milestones/$milestone", MilestoneInput("v1.0", null))
        put("/api/v1/projects/$id/milestone-label", MilestoneLabel("Releases"))
        val view =
            postJson(
                "/api/v1/projects/$id/saved-views",
                ViewInput("Board", "board", "status", "{}", "manual"),
            ).asUuid()
        expectProblem(
            put("/api/v1/saved-views/$view", ViewInput("Board", "board", "status", "{", "manual")),
            422,
            "invalid",
        )

        val flow = workflow()
        assertEquals("Spike", flow["types"][0]["name"].asString())
        assertEquals("flag", flow["types"][0]["icon"].asString())
        assertEquals(listOf("Done", "Todo"), flow["statuses"].values().map { it["name"].asString() })
        assertEquals("v1.0", flow["milestones"][0]["name"].asString())
        assertEquals("Releases", getJson("/api/v1/projects").first()["milestoneLabel"].asString())

        val task = create(input("Plan", id)).id()
        assertEquals(
            milestone,
            putJson("/api/v1/tasks/$task/milestone", TaskMilestoneId(milestone)).uuidOrNull("milestoneId"),
        )
        delete("/api/v1/milestones/$milestone").andExpect { status { isNoContent() } }
        assertNull(task(task).uuidOrNull("milestoneId"))
        delete("/api/v1/saved-views/$view").andExpect { status { isNoContent() } }
        delete("/api/v1/item-types/$type").andExpect { status { isNoContent() } }
        expectProblem(delete("/api/v1/saved-views/$view"), 404, "notFound")
        assertTrue(workflow()["types"].isEmpty && workflow()["views"].isEmpty)
    }

    @Test
    fun `keeps each user's workflow apart`() {
        val id = project("App")
        apply(id, preset("software"))
        val status = idOf("statuses", id, "Todo")
        val type = idOf("types", id, "Bug")
        subject = UUID.randomUUID().toString()
        assertTrue(workflow()["statuses"].isEmpty)
        expectProblem(put("/api/v1/projects/$id/preset", preset("software")), 404, "notFound")
        expectProblem(put("/api/v1/item-statuses/$status", StatusInput("Mine", "todo")), 404, "notFound")
        expectProblem(delete("/api/v1/item-types/$type"), 404, "notFound")
        expectProblem(post("/api/v1/projects/$id/milestones", MilestoneInput("x", null)), 404, "notFound")
        val mine = project("Mine")
        val task = create(input("Mine", mine)).id()
        expectProblem(put("/api/v1/tasks/$task/status", TaskStatusId(status)), 404, "notFound")
        expectProblem(setType(task, type), 404, "notFound")
        assertTrue(getJson("/api/v1/events?from=2026-01-01&to=2027-01-01").isEmpty)
    }
}
