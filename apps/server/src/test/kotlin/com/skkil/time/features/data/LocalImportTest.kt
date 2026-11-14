package com.skkil.time.features.data

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.error.DomainException
import com.skkil.time.common.error.ErrorKind
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.id.UuidV7Generator
import com.skkil.time.common.web.Caller
import com.skkil.time.features.mutations.domain.MutationDispatcher
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.test.assertEquals

class LocalImportTest : TaskApiTest() {
    @Autowired lateinit var mutations: MutationDispatcher

    private val monday = LocalDate.parse("2026-11-02")

    private fun caller() = Caller(userId(), scopeId(), ZoneId.of(zone))

    private fun upload(vararg tables: Pair<String, List<Map<String, Any?>>>) {
        val data = mapOf("tables" to tables.map { (table, rows) -> mapOf("table" to table, "rows" to rows) })
        asServer {
            mutations.dispatch(
                caller(),
                "importLocal",
                mapper.valueToTree(mapOf("data" to data)),
                MutationClock.fixed(Instant.parse("2026-11-03T09:00:00Z")),
                UuidV7Generator(),
            )
        }
    }

    private fun refused(vararg tables: Pair<String, List<Map<String, Any?>>>): DomainException =
        assertThrows<DomainException> { upload(*tables) }

    private fun column(sql: String): List<String> =
        jdbc
            .sql(sql)
            .param("user", userId())
            .query { rs, _ -> rs.getString(1) }
            .list()
            .filterNotNull()

    private fun id() = UUID.randomUUID()

    /** What a signed-out desktop dumps: SQLite rows, booleans as 0/1, ids it chose and natural-key rows re-keyed. */
    private fun device(scope: UUID, project: UUID, task: UUID, step: UUID) =
        arrayOf(
            "project" to listOf(mapOf("id" to project, "name" to "Home", "color" to "teal", "archived" to 0)),
            "week" to listOf(mapOf("id" to NaturalIds.week(scope, monday), "start_date" to "$monday", "worked" to "a")),
            "day" to listOf(mapOf("id" to id(), "date" to "$monday", "felt" to 4, "skipped" to 0)),
            "task" to
                listOf(
                    mapOf(
                        "id" to step,
                        "title" to "Washer",
                        "parent_id" to task,
                        "project_id" to project,
                        "created_at" to 2,
                    ),
                    mapOf(
                        "id" to task,
                        "title" to "Fix the tap",
                        "project_id" to project,
                        "created_at" to 1,
                        "counts_as_time" to 1,
                        "improvement" to "ignored",
                    ),
                ),
            "running_timer" to listOf(mapOf("id" to id(), "task_id" to task, "started_at" to 100)),
            "ritual" to
                listOf(
                    mapOf(
                        "id" to id(),
                        "kind" to "morning",
                        "enabled" to 1,
                        "trigger" to "first_open",
                        "steps" to "feel",
                        "user_id" to 999,
                    ),
                ),
            "setting" to listOf(mapOf("id" to id(), "key" to "planning_time", "value" to "morning")),
        )

    @Test
    fun `uploads a device's rows with its ids, the account's natural ids, and logs every one`() {
        val scope = scopeId()
        val (project, task, step) = Triple(id(), id(), id())
        repeat(2) { upload(*device(scope, project, task, step)) }

        assertEquals(
            listOf("Fix the tap", "Washer"),
            getJson("/api/v1/tasks").values().map {
                it["title"].asString()
            }.sorted(),
        )
        assertEquals(task, task(step).uuid("parentId"))
        assertEquals(true, task(task)["countsAsTime"].asBoolean())
        assertEquals(listOf("${NaturalIds.day(scope, monday)}"), column("SELECT id FROM day WHERE user_id = :user"))
        assertEquals(
            listOf("${NaturalIds.runningTimer(scope)}"),
            column("SELECT id FROM running_timer WHERE user_id = :user"),
        )
        assertEquals(
            listOf("feel"),
            column("SELECT steps FROM ritual WHERE user_id = :user AND id = '${NaturalIds.ritual(scope, "morning")}'"),
        )
        assertEquals(5, column("SELECT id FROM ritual WHERE user_id = :user").size)
        assertEquals(
            listOf("${NaturalIds.setting(scope, "planning_time")}"),
            column("SELECT id FROM setting WHERE user_id = :user AND key = 'planning_time'"),
        )

        val logged =
            jdbc
                .sql("SELECT DISTINCT table_name FROM store_log WHERE scope_id = :scope AND row_id = :id")
                .param("scope", scope)
                .param("id", "$step")
                .query(String::class.java)
                .list()
        assertEquals(listOf("task"), logged)
        val loggedDay =
            jdbc
                .sql("SELECT count(*) FROM store_log WHERE scope_id = :scope AND table_name = 'day'")
                .param("scope", scope)
                .query(Long::class.java)
                .single()
        assertEquals(true, loggedDay >= 1)
    }

    @Test
    fun `merges rows into the account's rows that hold the same natural key`() {
        val group = postJson("/api/v1/groups", mapOf("name" to "Home")).id()
        val quarter = id()
        asServer {
            jdbc
                .sql("INSERT INTO quarter (id, user_id, label, start_date) VALUES (:id, :user, 'Q1', :start)")
                .param("id", quarter)
                .param("user", userId())
                .param("start", LocalDate.parse("2026-01-05"))
                .update()
        }
        val (theirGroup, theirQuarter, project, priority) = listOf(id(), id(), id(), id())
        upload(
            "project_group" to listOf(mapOf("id" to theirGroup, "name" to "home", "position" to 3)),
            "project" to listOf(mapOf("id" to project, "name" to "Garden", "group_id" to theirGroup)),
            "quarter" to listOf(mapOf("id" to theirQuarter, "label" to "Winter", "start_date" to "2026-01-05")),
            "priority" to listOf(mapOf("id" to priority, "quarter_id" to theirQuarter, "title" to "Rest")),
        )

        assertEquals(listOf("$group"), column("SELECT id FROM project_group WHERE user_id = :user"))
        assertEquals(listOf("home"), column("SELECT name FROM project_group WHERE user_id = :user"))
        assertEquals(listOf("$group"), column("SELECT group_id FROM project WHERE user_id = :user"))
        assertEquals(listOf("Winter"), column("SELECT label FROM quarter WHERE user_id = :user"))
        assertEquals(listOf("$quarter"), column("SELECT quarter_id FROM priority WHERE user_id = :user"))
        assertEquals(listOf("$priority"), column("SELECT id FROM priority WHERE user_id = :user"))
    }

    @Test
    fun `refuses another account's rows and references, strange tables and rows without ids, writing nothing`() {
        val theirs = project("Theirs")
        val theirTask = create(input("Theirs", theirs)).id()
        subject = UUID.randomUUID().toString()

        val taken = refused("project" to listOf(mapOf("id" to theirs, "name" to "Mine")))
        assertEquals(ErrorKind.CONFLICT, taken.kind)
        assertEquals("That id is already taken.", taken.message)

        val mine = id()
        val pointing =
            refused(
                "project" to listOf(mapOf("id" to mine, "name" to "Mine")),
                "time_block" to listOf(mapOf("id" to id(), "task_id" to theirTask, "start_at" to 1, "end_at" to 2)),
            )
        assertEquals(ErrorKind.INVALID, pointing.kind)
        assertEquals("A time_block row points at a task that isn't there.", pointing.message)

        assertEquals("“device_setting” can't be imported.", refused("device_setting" to emptyList()).message)
        assertEquals("“user_preference” can't be imported.", refused("user_preference" to emptyList()).message)
        assertEquals("A task row has no id.", refused("task" to listOf(mapOf("id" to 7, "title" to "Odd"))).message)
        assertEquals(
            "A project row's “archived” isn't valid.",
            refused("project" to listOf(mapOf("id" to id(), "name" to "Odd", "archived" to 2))).message,
        )
        assertEquals(0, getJson("/api/v1/projects").size())
    }
}
