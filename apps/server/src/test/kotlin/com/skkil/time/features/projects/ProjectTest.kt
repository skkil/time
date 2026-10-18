package com.skkil.time.features.projects

import com.skkil.time.features.projects.api.Archived
import com.skkil.time.features.projects.api.CanvasContent
import com.skkil.time.features.projects.api.GroupName
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.projects.domain.ProjectSettings
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ProjectTest : ApiTest() {
    private fun project(name: String, parentId: UUID? = null) =
        postJson("/api/v1/projects", ProjectInput(name, parentId, "blue")).id()

    private fun settings(groupId: UUID?, status: String = "active") =
        ProjectSettings(groupId, status, "", 360, null, "", 1, false)

    @Test
    fun `nests up to three levels`() {
        val a = project("School")
        val b = project("Algorithms", a)
        val c = project("Homework", b)
        expectProblem(post("/api/v1/projects", ProjectInput("Too deep", c, "blue")), 422, "invalid")
    }

    @Test
    fun `refuses cycles and deep moves`() {
        val a = project("A")
        val b = project("B", a)
        val other = project("Other")
        val otherChild = project("Other child", other)
        expectProblem(put("/api/v1/projects/$a", ProjectInput("A", b, "blue")), 422, "invalid")
        expectProblem(put("/api/v1/projects/$a", ProjectInput("A", otherChild, "blue")), 422, "invalid")
        assertEquals(other, putJson("/api/v1/projects/$a", ProjectInput("A", other, "blue")).uuid("parentId"))
    }

    @Test
    fun `groups belong to top-level projects`() {
        val acme = postJson("/api/v1/groups", GroupName("Acme")).id()
        val site = project("Website")
        val page = project("Landing page", site)
        assertEquals(acme, putJson("/api/v1/projects/$site/settings", settings(acme)).uuid("groupId"))
        expectProblem(put("/api/v1/projects/$page/settings", settings(acme)), 422, "invalid")
        expectProblem(put("/api/v1/projects/$site/settings", settings(UUID.randomUUID())), 404, "notFound")

        val other = project("Other")
        assertTrue(putJson("/api/v1/projects/$site", ProjectInput("Website", other, "blue"))["groupId"].isNull)

        val done = putJson("/api/v1/projects/$page/settings", settings(null, "done"))
        assertEquals(360, done["weeklyMinutes"].asInt())
        assertTrue(!postJson("/api/v1/projects/$page/review")["lastReviewedAt"].isNull)
    }

    @Test
    fun `archives and deletes the whole subtree`() {
        val a = project("A")
        val b = project("B", a)
        put("/api/v1/projects/$a/archived", Archived(true)).andExpect { status { isNoContent() } }
        assertTrue(getJson("/api/v1/projects").first { it.id() == b }["archived"].asBoolean())
        expectProblem(put("/api/v1/projects/$b/archived", Archived(false)), 422, "invalid")
        delete("/api/v1/projects/$a").andExpect { status { isNoContent() } }
        assertEquals(0, getJson("/api/v1/projects").size())
    }

    @Test
    fun `keeps each user's projects apart`() {
        val mine = project("Mine")
        subject = UUID.randomUUID().toString()
        assertEquals(0, getJson("/api/v1/projects").size())
        expectProblem(put("/api/v1/projects/$mine", ProjectInput("Theirs", null, "blue")), 404, "notFound")
        expectProblem(post("/api/v1/projects", ProjectInput("Child", mine, "blue")), 404, "notFound")
    }

    @Test
    fun `group names are unique per user, ignoring case`() {
        postJson("/api/v1/groups", GroupName("Acme"))
        expectProblem(post("/api/v1/groups", GroupName("acme")), 422, "invalid")
        subject = UUID.randomUUID().toString()
        postJson("/api/v1/groups", GroupName("Acme"))
    }

    @Test
    fun `saves and reads the canvas`() {
        val id = project("Notes")
        val empty = getJson("/api/v1/projects/$id/canvas")
        assertEquals("", empty["content"].asString())
        assertTrue(empty["updatedAt"].isNull)
        val saved = putJson("/api/v1/projects/$id/canvas", CanvasContent("<p>Plan</p>"))
        assertEquals("<p>Plan</p>", saved["content"].asString())
        assertTrue(!saved["updatedAt"].isNull)
    }
}
