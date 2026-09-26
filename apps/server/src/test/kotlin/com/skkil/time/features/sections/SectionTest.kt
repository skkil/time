package com.skkil.time.features.sections

import com.skkil.time.features.projects.Archived
import com.skkil.time.features.projects.ProjectInput
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class SectionTest : ApiTest() {
    private fun names(): List<String> = getJson("/api/v1/sections").values().map { it["name"].asString() }

    @Test
    fun `places sections before a sibling and reorders them`() {
        val a = postJson("/api/v1/sections", SectionInput(null, "A", null))["id"].asLong()
        val c = postJson("/api/v1/sections", SectionInput(null, "C", null))["id"].asLong()
        postJson("/api/v1/sections", SectionInput(null, "B", c))
        assertEquals(listOf("A", "B", "C"), names())
        putJson("/api/v1/sections/$a/position", SectionPlacement(null))
        assertEquals(listOf("B", "C", "A"), names())
    }

    @Test
    fun `renames, collapses and deletes`() {
        val id = postJson("/api/v1/sections", SectionInput(null, "Todo", null))["id"].asLong()
        assertEquals("Done", putJson("/api/v1/sections/$id/name", SectionName(" Done "))["name"].asString())
        assertEquals(true, putJson("/api/v1/sections/$id/collapsed", SectionCollapsed(true))["collapsed"].asBoolean())
        expectProblem(put("/api/v1/sections/$id/name", SectionName("  ")), 422, "invalid")
        delete("/api/v1/sections/$id").andExpect { status { isNoContent() } }
        expectProblem(delete("/api/v1/sections/$id"), 404, "notFound")
    }

    @Test
    fun `refuses sections in an archived project`() {
        val project = postJson("/api/v1/projects", ProjectInput("Old", null, "blue"))["id"].asLong()
        put("/api/v1/projects/$project/archived", Archived(true))
        expectProblem(post("/api/v1/sections", SectionInput(project, "Late", null)), 422, "invalid")
    }
}
