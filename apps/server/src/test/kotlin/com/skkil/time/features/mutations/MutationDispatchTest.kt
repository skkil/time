package com.skkil.time.features.mutations

import com.skkil.time.common.clock.Hlc
import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.error.DomainException
import com.skkil.time.common.error.ErrorKind
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.id.UuidV7Generator
import com.skkil.time.common.web.Caller
import com.skkil.time.features.mutations.domain.MutationDispatcher
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.time.domain.TimeEntry
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import kotlin.test.assertEquals

class MutationDispatchTest : TaskApiTest() {
    @Autowired lateinit var mutations: MutationDispatcher

    private val acted = Instant.parse("2026-03-04T05:06:07Z")

    private fun caller() = Caller(userId(), ZoneId.of(zone))

    private fun ids(vararg ids: UUID): IdGenerator {
        val next = ids.iterator()
        return IdGenerator { next.next() }
    }

    private fun dispatch(
        name: String,
        args: Map<String, Any?> = emptyMap(),
        at: Instant = acted,
        idSource: IdGenerator = UuidV7Generator(),
    ): Any? = mutations.dispatch(caller(), name, mapper.valueToTree(args), MutationClock.fixed(at), idSource)

    private fun quarterArgs(id: UUID?, label: String) = mapOf("id" to id, "label" to label, "startDate" to "2026-01-05")

    private fun projectArgs(name: String) =
        mapOf("input" to mapOf("name" to name, "parentId" to null, "color" to "teal"))

    private fun failure(block: () -> Unit): DomainException = assertThrows<DomainException> { block() }

    @Test
    fun `creates rows with the ids and clock the mutation brings`() {
        val project = UUID.randomUUID()
        val task = UUID.randomUUID()
        dispatch("createProject", projectArgs("Thesis"), idSource = ids(project))
        val created =
            dispatch(
                "createTask",
                mapOf("input" to input("Draft", project)),
                at = Hlc.instant(Hlc.of(acted.toEpochMilli(), 3)),
                idSource = ids(task),
            ) as Task

        assertEquals(task, created.id)
        assertEquals(acted.epochSecond, created.createdAt)
        val read = task(task)
        assertEquals(project, read.uuid("projectId"))
        assertEquals(acted.epochSecond, read["createdAt"].asLong())
    }

    @Test
    fun `now and today come from the mutation clock`() {
        val task = create(input("Call")).id()
        val done = dispatch("setTaskCompleted", mapOf("id" to task, "completed" to true)) as Task
        assertEquals(acted.epochSecond, done.completedAt)

        val tomorrow = acted.atZone(ZoneId.of(zone)).toLocalDate().plusDays(1)
        val early = failure { dispatch("rateDay", mapOf("date" to tomorrow, "felt" to 4)) }
        assertEquals("That day hasn't happened yet.", early.message)
        dispatch("rateDay", mapOf("date" to tomorrow, "felt" to 4), at = acted.plusSeconds(86_400))
        assertEquals(4, getJson("/api/v1/days?from=$tomorrow&to=${tomorrow.plusDays(1)}")[0]["felt"].asInt())
    }

    @Test
    fun `a timer started and stopped by mutations logs the span between their clocks`() {
        val task = create(input("Write")).id()
        val entry = UUID.randomUUID()
        dispatch("startTimer", mapOf("details" to mapOf("description" to "", "projectId" to null, "taskId" to task)))
        val stopped =
            dispatch("stopTimer", at = acted.plusSeconds(1500), idSource = ids(entry)) as TimeEntry
        assertEquals(entry, stopped.id)
        assertEquals(acted.epochSecond, stopped.startedAt)
        assertEquals(acted.epochSecond + 1500, stopped.endedAt)
    }

    @Test
    fun `moves, sections and quarters follow the contract's arguments`() {
        val section = UUID.randomUUID()
        val quarter = UUID.randomUUID()
        dispatch(
            "createSection",
            mapOf("projectId" to null, "name" to "Later", "before" to null),
            idSource = ids(section),
        )
        val task = create(input("Read")).id()
        val placement = mapOf("projectId" to null, "sectionId" to section, "parentId" to null, "before" to null)
        val moved = dispatch("moveTask", mapOf("id" to task, "placement" to placement)) as Task
        assertEquals(section, moved.sectionId)

        val created = dispatch("upsertQuarter", quarterArgs(null, "Q1"), idSource = ids(quarter))
        assertEquals(quarter, created)
        assertEquals(quarter, dispatch("upsertQuarter", quarterArgs(quarter, "Q1 2026")))
        assertEquals("Q1 2026", getJson("/api/v1/quarter?date=2026-02-02")["label"].asString())
    }

    @Test
    fun `an id another row already has is a conflict, in this account or another`() {
        val taken = create(input("Mine")).id()
        val sameScope = failure { dispatch("createTask", mapOf("input" to input("Again")), idSource = ids(taken)) }
        assertEquals(ErrorKind.CONFLICT, sameScope.kind)

        subject = UUID.randomUUID().toString()
        val otherScope = failure { dispatch("createTask", mapOf("input" to input("Theirs")), idSource = ids(taken)) }
        assertEquals(ErrorKind.CONFLICT, otherScope.kind)
        assertEquals("That id is already taken.", otherScope.message)
        assertEquals(0, getJson("/api/v1/tasks").size())
        expectProblem(get("/api/v1/tasks/$taken"), 404, "notFound")
    }

    @Test
    fun `refuses unknown names and bad arguments without writing`() {
        assertEquals(ErrorKind.INVALID, failure { dispatch("dropDatabase") }.kind)
        assertEquals("The “input” argument is missing.", failure { dispatch("createTask") }.message)
        assertEquals(
            "The “id” argument isn't valid.",
            failure {
                dispatch("deleteTask", mapOf("id" to "nope"))
            }.message,
        )
        val rejected = failure { dispatch("createTask", mapOf("input" to input(" "))) }
        assertEquals(ErrorKind.INVALID, rejected.kind)
        assertEquals(0, getJson("/api/v1/tasks").size())
    }
}
