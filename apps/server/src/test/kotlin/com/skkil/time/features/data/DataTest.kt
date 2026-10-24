package com.skkil.time.features.data

import com.skkil.time.common.persistence.uuid
import com.skkil.time.features.data.domain.ColumnType
import com.skkil.time.features.data.domain.TABLES
import com.skkil.time.features.projects.api.CanvasContent
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.settings.api.Enabled
import com.skkil.time.features.tasks.api.TaskDependency
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import tools.jackson.databind.JsonNode
import tools.jackson.databind.node.ObjectNode
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class DataTest : TaskApiTest() {
    private val week = LocalDate.of(2026, 11, 2)

    private data class Seeded(val home: UUID, val garden: UUID, val sink: UUID, val washer: UUID, val mow: UUID)

    private fun seed(): Seeded {
        val home = project("Home")
        val garden = postJson("/api/v1/projects", ProjectInput("Garden", home, "green")).id()
        val beds = section(garden, "Beds")
        val sink = create(input("Fix sink", home)).id()
        val washer = create(input("Buy washer").copy(parentId = sink)).id()
        val mow = create(input("Mow", garden).copy(sectionId = beds)).id()
        post("/api/v1/tasks/$mow/dependencies", TaskDependency(sink))
        put("/api/v1/projects/$home/canvas", CanvasContent("<p>Plan</p>"))
        put("/api/v1/settings/reminders", Enabled(false))
        val user = userId()
        asServer {
            jdbc.sql("INSERT INTO week (id, user_id, start_date, felt) VALUES (gen_random_uuid(), :user, :week, 4)")
                .param("user", user)
                .param("week", week)
                .update()
        }
        val outcome =
            asServer {
                jdbc
                    .sql(
                        "INSERT INTO outcome (id, user_id, week_start, title) " +
                            "VALUES (gen_random_uuid(), :user, :week, 'Ship') RETURNING id",
                    ).param("user", user)
                    .param("week", week)
                    .query(UUID::class.java)
                    .single()
            }
        asServer {
            jdbc.sql(
                "UPDATE task SET outcome_id = :outcome WHERE id = :id",
            ).param("outcome", outcome).param("id", sink).update()
        }
        asServer {
            jdbc
                .sql(
                    "INSERT INTO time_entry (id, user_id, project_id, task_id, started_at, ended_at) " +
                        "VALUES (gen_random_uuid(), :user, :p, :t, 100, 400)",
                ).param("user", user)
                .param("p", home)
                .param("t", washer)
                .update()
        }
        val habit =
            asServer {
                jdbc
                    .sql(
                        """
                    INSERT INTO habit (id, user_id, name, goal, start_date, track_source, track_project_id)
                    VALUES (gen_random_uuid(), :user, 'Read', 1.5, :week, 'project', :p) RETURNING id
                    """,
                    ).param("user", user)
                    .param("week", week)
                    .param("p", garden)
                    .query(UUID::class.java)
                    .single()
            }
        asServer {
            jdbc.sql(
                "INSERT INTO habit_log (id, habit_id, date, status, value) VALUES (gen_random_uuid(), :h, :week, 'done', 2.5)",
            )
                .param("h", habit)
                .param("week", week)
                .update()
        }
        return Seeded(home, garden, sink, washer, mow)
    }

    private fun export(): JsonNode = getJson("/api/v1/data/export")

    private fun restore(document: JsonNode) = post("/api/v1/data/import", document)

    private fun projects() = getJson("/api/v1/projects").values().associateBy { it["name"].asString() }

    private fun tasks() = getJson("/api/v1/tasks").values().associateBy { it["title"].asString() }

    private fun count(table: String): Int =
        jdbc.sql(
            "SELECT COUNT(*) FROM $table WHERE user_id = :user",
        ).param("user", userId()).query(Int::class.java).single()

    @Test
    fun `exports every owned table without user ids`() {
        val seeded = seed()
        val document = export()
        assertEquals("skkil-time", document["format"].asString())
        assertEquals(2, document["version"].asInt())
        val tables = document["tables"]
        assertEquals(TABLES.map { it.name }.toSet(), tables.propertyNames().toSet())
        val projects = tables["project"].values().toList()
        assertEquals(setOf(seeded.home, seeded.garden), projects.map { it.id() }.toSet())
        assertFalse(projects.first().has("user_id"))
        assertEquals("2026-11-02", tables["week"][0]["start_date"].asString())
        assertEquals(2.5, tables["habit_log"][0]["value"].asDouble())
        assertEquals("<p>Plan</p>", tables["project_canvas"][0]["content"].asString())
        assertEquals(5, tables["ritual"].size())
    }

    @Test
    fun `restores a backup with fresh ids and every link intact`() {
        val seeded = seed()
        val backup = export()
        delete("/api/v1/projects/${seeded.home}")
        project("Newer")

        restore(backup).andExpect { status { isNoContent() } }

        val projects = projects()
        assertEquals(setOf("Home", "Garden"), projects.keys)
        val home = projects.getValue("Home").id()
        val garden = projects.getValue("Garden")
        assertNotEquals(seeded.home, home)
        assertEquals(home, garden.uuidOrNull("parentId"))
        val tasks = tasks()
        val sink = tasks.getValue("Fix sink")
        val washer = tasks.getValue("Buy washer")
        val mow = tasks.getValue("Mow")
        assertEquals(sink.id(), washer.uuidOrNull("parentId"))
        assertEquals(listOf(sink.id()), mow.uuids("blockedBy"))
        assertEquals(getJson("/api/v1/sections").values().single().id(), mow.uuidOrNull("sectionId"))
        assertEquals("<p>Plan</p>", getJson("/api/v1/projects/$home/canvas")["content"].asString())
        assertEquals(false, getJson("/api/v1/settings/reminders").asBoolean())
        val user = userId()
        val entry =
            jdbc
                .sql("SELECT project_id, task_id FROM time_entry WHERE user_id = :user")
                .param("user", user)
                .query { rs, _ -> rs.uuid("project_id") to rs.uuid("task_id") }
                .single()
        assertEquals(home to washer.id(), entry)
        val outcome =
            jdbc.sql(
                "SELECT id FROM outcome WHERE user_id = :user",
            ).param("user", user).query(UUID::class.java).single()
        assertEquals(outcome, sink.uuidOrNull("outcomeId"))
        val habitProject =
            jdbc
                .sql("SELECT track_project_id FROM habit WHERE user_id = :user")
                .param("user", user)
                .query(UUID::class.java)
                .single()
        assertEquals(garden.id(), habitProject)
        assertEquals(5, count("ritual"))
    }

    @Test
    fun `restores a version 1 backup with integer ids`() {
        seed()
        val backup = export().deepCopy() as ObjectNode
        backup.put("version", 1)
        val numbers = mutableMapOf<String, Long>()
        for (table in TABLES) {
            val idColumns = table.columns.filter { it.type == ColumnType.UUID }.map { it.name }
            for (row in backup["tables"][table.name].values()) {
                for (column in idColumns) {
                    val value = row[column]?.takeUnless { it.isNull }?.asString() ?: continue
                    (row as ObjectNode).put(column, numbers.getOrPut(value) { numbers.size + 1L })
                }
            }
        }

        restore(backup).andExpect { status { isNoContent() } }

        val tasks = tasks()
        assertEquals(tasks.getValue("Fix sink").id(), tasks.getValue("Buy washer").uuidOrNull("parentId"))
        assertEquals(listOf(tasks.getValue("Fix sink").id()), tasks.getValue("Mow").uuids("blockedBy"))
    }

    @Test
    fun `refuses files that are not backups and leaves the data alone`() {
        seed()
        val backup = export()
        expectProblem(restore(mapper.createObjectNode().put("format", "other")), 422, "invalid")
        expectProblem(restore(mapper.valueToTree("not json")), 422, "invalid")
        val newer = backup.deepCopy() as ObjectNode
        newer.put("version", 3)
        restore(newer).andExpect {
            status { isEqualTo(422) }
            jsonPath("$.detail") { value("That backup comes from a newer version of skkil time.") }
        }
        val dangling = backup.deepCopy() as ObjectNode
        (dangling["tables"]["task"][0] as ObjectNode).put("project_id", UUID.randomUUID().toString())
        expectProblem(restore(dangling), 422, "invalid")
        val broken = backup.deepCopy() as ObjectNode
        (broken["tables"]["project"][0] as ObjectNode).put("status", "lost")
        expectProblem(restore(broken), 422, "invalid")
        assertEquals(setOf("Home", "Garden"), projects().keys)
        assertEquals(3, tasks().size)
    }

    @Test
    fun `a restore touches only the caller's data`() {
        seed()
        val backup = export()
        val owner = subject
        subject = UUID.randomUUID().toString()
        assertTrue(export()["tables"]["project"].isEmpty)
        restore(backup).andExpect { status { isNoContent() } }
        assertEquals(setOf("Home", "Garden"), projects().keys)
        val copy = projects().getValue("Home").id()
        deleteJson("/api/v1/data")
        subject = owner
        assertEquals(setOf("Home", "Garden"), projects().keys)
        assertNotEquals(copy, projects().getValue("Home").id())
        assertEquals(3, tasks().size)
    }

    @Test
    fun `deleting everything empties the data and restores defaults`() {
        seed()
        asServer { jdbc.sql("DELETE FROM ritual WHERE user_id = :user").param("user", userId()).update() }

        delete("/api/v1/data").andExpect { status { isNoContent() } }

        assertTrue(projects().isEmpty())
        assertTrue(tasks().isEmpty())
        assertEquals(0, count("habit") + count("time_entry") + count("week") + count("setting"))
        assertEquals(true, getJson("/api/v1/settings/reminders").asBoolean())
        assertEquals(5, count("ritual"))
    }
}
