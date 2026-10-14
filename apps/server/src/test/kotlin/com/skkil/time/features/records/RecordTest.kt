package com.skkil.time.features.records

import com.skkil.time.features.records.api.PhaseNotes
import com.skkil.time.features.records.api.PhaseTaskInput
import com.skkil.time.features.records.api.TaskPhase
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.workflow.api.TaskTypeId
import com.skkil.time.features.workflow.domain.PRESETS
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RecordTest : TaskApiTest() {
    private fun jobSearch(name: String): Long {
        val id = project(name)
        put("/api/v1/projects/$id/preset", PRESETS.first { it.key == "job_search" })
        return id
    }

    private fun status(project: Long, name: String): Long =
        getJson("/api/v1/workflow")["statuses"]
            .values()
            .first { it["projectId"].asLong() == project && it["name"].asString() == name }["id"]
            .asLong()

    private fun application(project: Long, title: String): JsonNode {
        val recordType =
            getJson("/api/v1/workflow")["types"]
                .values()
                .first { it["projectId"].asLong() == project && it["kind"].asString() == "record" }["id"]
                .asLong()
        val task = create(input(title, project)).id()
        return putJson("/api/v1/tasks/$task/type", TaskTypeId(recordType))
    }

    private fun phaseTask(record: Long, phase: Long, title: String) =
        postJson("/api/v1/tasks/$record/phase-tasks", PhaseTaskInput(phase, title))

    private fun setNotes(task: Long, status: Long, notes: String) =
        put("/api/v1/tasks/$task/phases/$status/notes", PhaseNotes(notes))

    private fun phases(task: Long) = getJson("/api/v1/tasks/$task/phases").values().toList()

    @Test
    fun `records hold tasks and notes per phase`() {
        val project = jobSearch("Jobs")
        val applied = status(project, "Applied")
        val interviewing = status(project, "Interviewing")
        val acme = application(project, "Acme")
        assertEquals("record", acme["kind"].asString())

        val cover = phaseTask(acme.id(), applied, "Write cover letter")
        assertEquals(acme.id(), cover.longOrNull("parentId"))
        assertEquals(applied, cover.longOrNull("phaseId"))
        val prep = phaseTask(acme.id(), interviewing, "Practise system design")
        assertNull(putJson("/api/v1/tasks/${prep.id()}/phase", TaskPhase(null)).longOrNull("phaseId"))

        setNotes(acme.id(), interviewing, "Panel of three").andExpect { status { isNoContent() } }
        setNotes(acme.id(), applied, "Sent via referral")
        setNotes(acme.id(), applied, "  ")
        val notes = phases(acme.id())
        assertEquals(1, notes.size)
        assertEquals("Panel of three", notes[0]["notes"].asString())

        val plain = create(input("Update CV", project)).id()
        setNotes(plain, applied, "x").andExpect { jsonPath("$.detail") { value("Only records have phases.") } }
        expectProblem(put("/api/v1/tasks/$plain/phase", TaskPhase(applied)), 422, "invalid")
    }

    @Test
    fun `moving a record keeps phases by name`() {
        val a = jobSearch("Jobs 2026")
        val b = jobSearch("Jobs 2027")
        val acme = application(a, "Acme").id()
        val task = phaseTask(acme, status(a, "Offer"), "Negotiate").id()
        setNotes(acme, status(a, "Offer"), "Ask for remote")

        move(acme, TaskPlacement(b, null, null, null))
        val offer = status(b, "Offer")
        assertEquals(offer, task(task).longOrNull("phaseId"))
        assertEquals(offer, phases(acme)[0]["statusId"].asLong())
    }

    @Test
    fun `keeps each user's records apart`() {
        val project = jobSearch("Jobs")
        val applied = status(project, "Applied")
        val acme = application(project, "Acme").id()
        setNotes(acme, applied, "Private")
        subject = UUID.randomUUID().toString()
        assertEquals(0, phases(acme).size)
        expectProblem(setNotes(acme, applied, "Mine"), 404, "notFound")
        expectProblem(post("/api/v1/tasks/$acme/phase-tasks", PhaseTaskInput(applied, "Sneak")), 404, "notFound")
        val mine = create(input("Mine")).id()
        expectProblem(put("/api/v1/tasks/$mine/phase", TaskPhase(applied)), 422, "invalid")
    }
}
