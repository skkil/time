package com.skkil.time.features.tasks

import com.skkil.time.features.tasks.api.TaskDependency
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DependencyTest : TaskApiTest() {
    private fun add(task: Long, blocker: Long) = post("/api/v1/tasks/$task/dependencies", TaskDependency(blocker))

    @Test
    fun `waits until every blocker is done`() {
        val launch = create(input("Launch")).id()
        val copy = create(input("Write copy")).id()
        val site = create(input("Build site")).id()
        read(add(launch, copy))
        val waiting = read(add(launch, site))
        assertEquals(2, waiting.longs("blockedBy").size)
        assertEquals(2, waiting.longs("waitingOn").size)

        complete(copy)
        val after = task(launch)
        assertEquals(listOf(site), after.longs("waitingOn"))
        assertEquals(2, after.longs("blockedBy").size)

        assertTrue(deleteJson("/api/v1/tasks/$launch/dependencies/$site").longs("waitingOn").isEmpty())
    }

    @Test
    fun `refuses loops, self and repeating blockers`() {
        val a = create(input("A")).id()
        val b = create(input("B")).id()
        val c = create(input("C")).id()
        read(add(a, b))
        read(add(b, c))
        add(c, a).andExpect { jsonPath("$.detail") { value("“A” already waits on this task.") } }
        expectProblem(add(a, a), 422, "invalid")

        val daily = create(input("Inbox zero").copy(dueDate = LocalDate.parse("2026-11-03"), recurrence = "every day"))
        expectProblem(add(a, daily.id()), 422, "invalid")

        delete("/api/v1/tasks/$b")
        assertTrue(task(a).longs("blockedBy").isEmpty())
    }

    @Test
    fun `links only the caller's own tasks`() {
        val mine = create(input("Mine")).id()
        subject = UUID.randomUUID().toString()
        val theirs = create(input("Theirs")).id()
        expectProblem(add(theirs, mine), 404, "notFound")
        expectProblem(add(mine, theirs), 404, "notFound")
        expectProblem(delete("/api/v1/tasks/$mine/dependencies/$theirs"), 404, "notFound")
    }
}
