package com.skkil.time.features.tasks

import com.skkil.time.features.projects.api.Archived
import com.skkil.time.features.tasks.api.TaskCompleted
import com.skkil.time.features.tasks.api.TaskIds
import com.skkil.time.features.tasks.api.TaskMust
import com.skkil.time.features.tasks.api.TaskNextStep
import com.skkil.time.features.tasks.api.TaskOutcome
import com.skkil.time.features.tasks.api.TaskReschedule
import com.skkil.time.features.tasks.api.TasksMove
import com.skkil.time.features.tasks.domain.MoveTarget
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.tasks.domain.TaskRules
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TaskTest : TaskApiTest() {
    private fun titles() = getJson("/api/v1/tasks").values().map { it["title"].asString() }

    private fun inbox(before: UUID? = null) = TaskPlacement(null, null, null, before)

    @Test
    fun `hides tasks of archived projects`() {
        val side = project("Side")
        create(input("Inbox task"))
        create(input("Project task", side))
        put("/api/v1/projects/$side/archived", Archived(true))
        assertEquals(listOf("Inbox task"), titles())
    }

    @Test
    fun `leaves out tasks closed over two weeks ago`() {
        val old = create(input("Old")).id()
        create(input("Recent"))
        asServer {
            jdbc
                .sql("UPDATE task SET completed_at = :at WHERE id = :id")
                .param("at", Instant.now().epochSecond - 15 * TaskRules.DAY_SECONDS)
                .param("id", old)
                .update()
        }
        assertEquals(listOf("Recent"), titles())
        assertEquals("Old", task(old)["title"].asString())
    }

    @Test
    fun `validates fields`() {
        expectProblem(post("/api/v1/tasks", input("  ")), 422, "invalid")
        expectProblem(
            post("/api/v1/tasks", input("Write").copy(estimateMinutes = TaskRules.MAX_ESTIMATE_MINUTES + 1)),
            422,
            "invalid",
        )
        expectProblem(post("/api/v1/tasks", input("Call").copy(dueTime = 600)), 422, "invalid")
        post("/api/v1/tasks", input("Odd").copy(dueDate = today(), recurrence = "every 3 hours")).andExpect {
            jsonPath("$.detail") { value("Can't repeat “every 3 hours”.") }
        }
        val repeating = input("Run").copy(recurrence = "every day")
        assertEquals(today().toString(), create(repeating)["dueDate"].asString())
        val daily = create(repeating.copy(dueDate = LocalDate.parse("2026-11-02"), recurrence = "Daily"))
        assertEquals("every day", daily["recurrence"].asString())
    }

    @Test
    fun `a new repeat starts on its first occurrence`() {
        val created = create(input("Standup").copy(recurrence = "every mon", dueTime = 600))
        assertEquals(DayOfWeek.MONDAY, LocalDate.parse(created["dueDate"].asString()).dayOfWeek)
        assertEquals(600, created["dueTime"].asInt())
    }

    @Test
    fun `a repeat closes after its end date`() {
        val task = create(input("Stretch").copy(dueDate = today(), recurrence = "every day ending ${today()}"))
        assertFalse(complete(task.id())["completedAt"].isNull)
    }

    @Test
    fun `deep subtasks follow every ancestor`() {
        val school = project("School")
        val work = project("Work")
        val root = create(input("Root", school)).id()
        val chain = mutableListOf(root)
        for (depth in 1..8) chain += create(input("Level $depth").copy(parentId = chain.last())).id()
        val deepest = chain.last()
        assertEquals(school, task(deepest).uuidOrNull("projectId"))

        expectProblem(put("/api/v1/tasks/$root", input("Root", school).copy(parentId = deepest)), 422, "invalid")

        move(root, TaskPlacement(work, null, null, null))
        assertEquals(work, task(deepest).uuidOrNull("projectId"))

        complete(root)
        assertFalse(task(deepest)["completedAt"].isNull)

        delete("/api/v1/tasks/$root").andExpect { status { isNoContent() } }
        expectProblem(get("/api/v1/tasks/$deepest"), 404, "notFound")
    }

    @Test
    fun `subtasks follow parent and complete with it`() {
        val school = project("School")
        val week = section(school, "Week 9")
        val parent = create(input("Homework 3", school).copy(sectionId = week)).id()
        val child = create(input("Problem 1").copy(parentId = parent))
        assertEquals(school, child.uuidOrNull("projectId"))
        assertEquals(week, child.uuidOrNull("sectionId"))

        expectProblem(
            put("/api/v1/tasks/$parent", input("Homework 3", school).copy(parentId = child.id())),
            422,
            "invalid",
        )

        move(parent, inbox())
        assertNull(task(child.id()).uuidOrNull("projectId"))

        complete(parent)
        assertFalse(task(child.id())["completedAt"].isNull)
    }

    @Test
    fun `rejects sections from other projects`() {
        val a = project("A")
        val b = project("B")
        val doing = section(a, "Doing")
        expectProblem(post("/api/v1/tasks", input("Mixed", b).copy(sectionId = doing)), 422, "invalid")
    }

    @Test
    fun `orders siblings`() {
        val a = create(input("A")).id()
        val b = create(input("B")).id()
        val c = create(input("C")).id()
        move(c, inbox(before = a))
        assertEquals(listOf("C", "A", "B"), titles())
        assertEquals(3, task(b)["position"].asInt())
    }

    @Test
    fun `rescheduling a task`() {
        val today = today()
        val id = create(input("Essay").copy(dueDate = today.minusDays(1))).id()
        post("/api/v1/tasks/reschedule", TaskReschedule(listOf(id), today)).andExpect { status { isNoContent() } }
        assertEquals(today.toString(), task(id)["dueDate"].asString())

        val must = putJson("/api/v1/tasks/$id/must", TaskMust(today))
        assertEquals(today.toString(), must["mustOn"].asString())
        assertEquals(today.toString(), must["dueDate"].asString())

        post("/api/v1/tasks/reschedule", TaskReschedule(listOf(id), null))
        val cleared = task(id)
        assertTrue(cleared["dueDate"].isNull && cleared["mustOn"].isNull)
        expectProblem(
            post("/api/v1/tasks/reschedule", TaskReschedule(listOf(UUID.randomUUID()), today)),
            404,
            "notFound",
        )
    }

    @Test
    fun `moving to a week sets a window that a new date clears`() {
        val today = today()
        val monday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY))
        val id = create(input("Essay").copy(dueDate = today)).id()
        val moved = postJson("/api/v1/tasks/move", TasksMove(listOf(id), MoveTarget.Week(monday)))
        assertEquals(1, moved["tasks"].asInt())
        val window = task(id)
        assertEquals(monday.toString(), window["dueDate"].asString())
        assertEquals(monday.plusDays(6).toString(), window["dueUntil"].asString())

        postJson("/api/v1/tasks/move", TasksMove(listOf(id), MoveTarget.Day(monday.plusDays(2)), "leave"))
        assertTrue(task(id)["dueUntil"].isNull)

        expectProblem(
            post("/api/v1/tasks/move", TasksMove(listOf(id), MoveTarget.Week(monday.plusDays(1)))),
            422,
            "invalid",
        )
        expectProblem(post("/api/v1/tasks/move", TasksMove(listOf(id), MoveTarget.Day(today), "stay")), 422, "invalid")
        val repeat = create(input("Run").copy(dueDate = today, recurrence = "every day")).id()
        expectProblem(post("/api/v1/tasks/move", TasksMove(listOf(repeat), MoveTarget.Week(monday))), 422, "invalid")
    }

    @Test
    fun `completing a repeating task moves it forward`() {
        val id = create(input("Lecture").copy(dueDate = today(), recurrence = "every week")).id()
        val next = complete(id)
        assertTrue(next["completedAt"].isNull)
        assertEquals(today().plusDays(7).toString(), next["dueDate"].asString())
    }

    @Test
    fun `completing a task stops a timer on any of its steps`() {
        val parent = create(input("Pack")).id()
        val step = create(input("Socks").copy(parentId = parent)).id()
        asServer {
            jdbc
                .sql(
                    "INSERT INTO running_timer (id, user_id, task_id, started_at) VALUES (gen_random_uuid(), :user, :task, :at)",
                )
                .param("user", userId())
                .param("task", step)
                .param("at", Instant.now().epochSecond - 600)
                .update()
        }
        complete(parent)
        val running =
            jdbc.sql(
                "SELECT COUNT(*) FROM running_timer WHERE user_id = :user",
            ).param("user", userId()).query(Int::class.java).single()
        assertEquals(0, running)
        assertTrue(task(step)["trackedSeconds"].asLong() >= 600)
    }

    @Test
    fun `sets the outcome, next step and inherits the parent's outcome`() {
        val parent = create(input("Ship")).id()
        val step = create(input("Write").copy(parentId = parent)).id()
        expectProblem(put("/api/v1/tasks/$parent/outcome", TaskOutcome(UUID.randomUUID())), 404, "notFound")
        assertTrue(putJson("/api/v1/tasks/$parent/outcome", TaskOutcome(null))["outcomeId"].isNull)
        assertTrue(task(step)["outcomeId"].isNull)
        assertEquals(
            "Open the doc",
            putJson("/api/v1/tasks/$step/next-step", TaskNextStep(" Open the doc "))["nextStep"].asString(),
        )
        post("/api/v1/tasks/delete", TaskIds(listOf(parent))).andExpect { status { isNoContent() } }
        assertEquals(0, getJson("/api/v1/tasks").size())
    }

    @Test
    fun `keeps each user's tasks apart`() {
        val mine = create(input("Mine")).id()
        val project = project("Mine")
        val owner = subject
        subject = UUID.randomUUID().toString()
        assertEquals(0, getJson("/api/v1/tasks").size())
        expectProblem(get("/api/v1/tasks/$mine"), 404, "notFound")
        expectProblem(put("/api/v1/tasks/$mine", input("Theirs")), 404, "notFound")
        expectProblem(put("/api/v1/tasks/$mine/completed", TaskCompleted(true)), 404, "notFound")
        expectProblem(post("/api/v1/tasks", input("Child").copy(parentId = mine)), 404, "notFound")
        expectProblem(post("/api/v1/tasks", input("In theirs", project)), 404, "notFound")
        expectProblem(post("/api/v1/tasks/reschedule", TaskReschedule(listOf(mine), today())), 404, "notFound")
        expectProblem(post("/api/v1/tasks/move", TasksMove(listOf(mine), MoveTarget.Day(today()))), 404, "notFound")
        expectProblem(delete("/api/v1/tasks/$mine"), 404, "notFound")
        post("/api/v1/tasks/delete", TaskIds(listOf(mine)))
        val theirs = create(input("Theirs")).id()
        expectProblem(post("/api/v1/tasks/$theirs/move", TaskPlacement(null, null, mine, null)), 404, "notFound")
        subject = owner
        assertEquals("Mine", task(mine)["title"].asString())
    }
}
