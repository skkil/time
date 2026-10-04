package com.skkil.time.features.importing

import com.skkil.time.features.tasks.TaskApiTest
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ImportTest : TaskApiTest() {
    private fun item(title: String, vararg children: ImportTask) = ImportTask(input(title), children.toList())

    private fun project(name: String, tasks: List<ImportTask>, sections: List<ImportSection> = emptyList()) =
        ImportProject(name, "blue", tasks, sections)

    private fun tasks() = getJson("/api/v1/tasks").values().toList()

    @Test
    fun `imports sections and nested tasks`() {
        val ids =
            postJson(
                "/api/v1/import/projects",
                listOf(
                    project(
                        "Home",
                        listOf(item("Fix sink", item("Buy washer"))),
                        listOf(ImportSection("Garden", listOf(item("Mow")))),
                    ),
                ),
            ).values().map { it.asLong() }
        assertEquals(1, ids.size)
        val all = tasks()
        val sink = all.first { it["title"].asString() == "Fix sink" }
        val washer = all.first { it["title"].asString() == "Buy washer" }
        assertEquals(sink.id(), washer.longOrNull("parentId"))
        val mow = all.first { it["title"].asString() == "Mow" }
        assertNotNull(mow.longOrNull("sectionId"))
        assertEquals(ids[0], mow.longOrNull("projectId"))
    }

    @Test
    fun `a bad row leaves nothing behind`() {
        val result =
            post(
                "/api/v1/import/projects",
                listOf(project("Good", listOf(item("Fine"))), project("Bad", listOf(item("   ")))),
            )
        result.andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("Couldn't import “   ”: Task title can't be empty.") }
        }
        assertTrue(getJson("/api/v1/projects").isEmpty)
        assertTrue(tasks().isEmpty())
    }

    @Test
    fun `imports only into the caller's account`() {
        postJson("/api/v1/import/projects", listOf(project("Mine", listOf(item("Task")))))
        subject = UUID.randomUUID().toString()
        assertTrue(getJson("/api/v1/projects").isEmpty)
        assertTrue(tasks().isEmpty())
    }
}
