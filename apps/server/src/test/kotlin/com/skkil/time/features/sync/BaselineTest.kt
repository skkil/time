package com.skkil.time.features.sync

import com.skkil.time.features.projects.api.CanvasContent
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.settings.api.Enabled
import com.skkil.time.features.sync.domain.BASELINE_TABLES
import com.skkil.time.features.sync.job.BaselineJob
import com.skkil.time.features.sync.service.BASELINE_LOCK_KEY
import com.skkil.time.features.sync.service.BaselineService
import com.skkil.time.features.tasks.api.TaskDependency
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BaselineTest : TaskApiTest() {
    @Autowired lateinit var job: BaselineJob

    @Autowired lateinit var baselines: BaselineService

    @Autowired lateinit var transactions: PlatformTransactionManager

    private val transaction by lazy { TransactionTemplate(transactions) }

    private fun seed() {
        val home = project("Home")
        val garden = postJson("/api/v1/projects", ProjectInput("Garden", home, "green")).id()
        val sink = create(input("Fix sink", home).copy(sectionId = section(home, "Kitchen"))).id()
        create(input("Buy washer").copy(parentId = sink))
        val mow = create(input("Mow", garden)).id()
        post("/api/v1/tasks/$mow/dependencies", TaskDependency(sink))
        put("/api/v1/projects/$home/canvas", CanvasContent("<p>Plan</p>"))
        put("/api/v1/settings/reminders", Enabled(false))
        val user = userId()
        asServer {
            val habit =
                jdbc
                    .sql(
                        "INSERT INTO habit (id, user_id, name, goal, start_date) " +
                            "VALUES (gen_random_uuid(), :user, 'Read', 1, :day) RETURNING id",
                    ).param("user", user)
                    .param("day", DAY)
                    .query(UUID::class.java)
                    .single()
            jdbc
                .sql("INSERT INTO habit_log (id, habit_id, date, status) VALUES (gen_random_uuid(), :h, :day, 'done')")
                .param("h", habit)
                .param("day", DAY)
                .update()
        }
    }

    /** Makes the current account look like one from before `V13`: rows on the server, nothing in its log. */
    private fun forgetLog() {
        val user = userId()
        val scope = scopeId()
        jdbc.sql("DELETE FROM sync_baseline WHERE user_id = :user").param("user", user).update()
        jdbc.sql("SELECT store_drop_scope(:scope)").param("scope", scope).query().singleRow()
        transaction.execute {
            jdbc.sql("SET LOCAL store.bypass = on").update()
            jdbc.sql("UPDATE project SET name = 'Home, re-keyed' WHERE user_id = :user AND name = 'Home'")
                .param("user", user)
                .update()
        }
    }

    /** What a device holds after pulling the scope's log from [after]: each row's image by table and id. */
    private fun replica(scope: UUID = scopeId(), after: Long = 0): Map<Pair<String, String>, String> {
        val rows = mutableMapOf<Pair<String, String>, String>()
        jdbc
            .sql(
                """
                SELECT table_name, row_id, op, data::text AS data FROM store_log
                WHERE scope_id = :scope AND kind = 'patch' AND version > :after ORDER BY version, seq
                """,
            ).param("scope", scope)
            .param("after", after)
            .query { rs, _ ->
                val key = rs.getString("table_name") to rs.getString("row_id")
                if (rs.getString("op") == "delete") rows.remove(key) else rows[key] = rs.getString("data")
            }.list()
        return rows
    }

    /** Every synced row the account owns, as the capture trigger would image it. */
    private fun owned(user: Long = userId()): Map<Pair<String, String>, String> =
        BASELINE_TABLES
            .flatMap { table ->
                val filter =
                    table.parent?.let { "t.${table.column} IN (SELECT id FROM $it WHERE user_id = :user)" }
                        ?: "t.${table.column} = :user"
                jdbc
                    .sql(
                        """
                        SELECT t.id::text AS id,
                               (to_jsonb(t) - (SELECT excluded_columns FROM store_table WHERE table_name = :name))::text
                                 AS image
                        FROM ${table.name} t WHERE $filter
                        """,
                    ).param("user", user)
                    .param("name", table.name)
                    .query { rs, _ -> (table.name to rs.getString("id")) to rs.getString("image") }
                    .list()
            }.toMap()

    private fun head(scope: UUID = scopeId()): Long =
        jdbc
            .sql("SELECT coalesce((SELECT head_version FROM store_scope WHERE scope_id = :scope), 0)")
            .param("scope", scope)
            .query(Long::class.java)
            .single()

    private fun epoch(scope: UUID = scopeId()): Int =
        jdbc.sql(
            "SELECT epoch FROM store_scope WHERE scope_id = :scope",
        ).param("scope", scope).query(Int::class.java).single()

    private fun baselineVersion(user: Long = userId()): Long? =
        jdbc
            .sql("SELECT version FROM sync_baseline WHERE user_id = :user")
            .param("user", user)
            .query { rs, _ -> rs.getLong("version").takeUnless { rs.wasNull() } }
            .list()
            .single()

    private fun isBaselined(user: Long): Boolean =
        jdbc
            .sql("SELECT EXISTS (SELECT 1 FROM sync_baseline WHERE user_id = :user)")
            .param("user", user)
            .query(Boolean::class.java)
            .single()

    private fun legacyAccount(): Pair<Long, UUID> {
        newUser()
        seed()
        forgetLog()
        return userId() to scopeId()
    }

    @Test
    fun `the baseline covers every registered table, parents first`() {
        val registered = jdbc.sql("SELECT table_name FROM store_table").query(String::class.java).list().toSet()
        val order = BASELINE_TABLES.map { it.name }
        assertEquals(registered, order.toSet())
        assertEquals(order.size, order.toSet().size)
        val references =
            jdbc
                .sql(
                    """
                    SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint
                    WHERE contype = 'f' AND conrelid <> confrelid
                    """,
                ).query { rs, _ -> rs.getString("child") to rs.getString("parent") }
                .list()
                .filter { (child, parent) -> child in registered && parent in registered }
        assertTrue(references.isNotEmpty())
        for ((child, parent) in references) {
            assertTrue(order.indexOf(parent) < order.indexOf(child), "$parent must come before $child")
        }
        for (table in BASELINE_TABLES) {
            val columns =
                jdbc
                    .sql("SELECT column_name FROM information_schema.columns WHERE table_name = :t")
                    .param("t", table.name)
                    .query(String::class.java)
                    .list()
            assertTrue(table.column in columns, "${table.name}.${table.column}")
            table.parent?.let { assertTrue(order.indexOf(it) < order.indexOf(table.name)) }
        }
    }

    @Test
    fun `a new account is baselined at creation`() {
        userId()
        assertNull(baselineVersion())
        assertEquals(owned(), replica())
    }

    @Test
    fun `an account with rows from before the log gets them all through a pull from version 0`() {
        seed()
        forgetLog()
        assertTrue(replica().isEmpty())
        assertTrue(owned().keys.map { it.first }.containsAll(listOf("project_canvas", "task_dependency", "habit_log")))

        job.run()

        assertEquals(owned(), replica())
        assertEquals(1, head())
        assertEquals(1, baselineVersion())
    }

    @Test
    fun `the baseline is idempotent`() {
        seed()
        forgetLog()
        job.run()
        val after = replica()
        val version = head()

        job.run()

        assertFalse(baselines.baseline(userId(), scopeId()))
        assertEquals(version, head())
        assertEquals(after, replica())
    }

    @Test
    fun `an account another instance is baselining is left to it`() {
        seed()
        forgetLog()
        val user = userId()
        val held = CountDownLatch(1)
        val release = CountDownLatch(1)
        val holder =
            Executors.newSingleThreadExecutor().submit {
                transaction.execute {
                    jdbc
                        .sql("SELECT pg_advisory_xact_lock(:key, hashint8(:user))")
                        .param("key", BASELINE_LOCK_KEY)
                        .param("user", user)
                        .query()
                        .singleRow()
                    held.countDown()
                    release.await(10, TimeUnit.SECONDS)
                }
            }
        held.await(10, TimeUnit.SECONDS)

        assertFalse(baselines.baseline(user, scopeId()))
        assertFalse(isBaselined(user))
        release.countDown()
        holder.get(10, TimeUnit.SECONDS)

        assertTrue(baselines.baseline(user, scopeId()))
        assertEquals(owned(), replica())
    }

    @Test
    fun `two concurrent runs baseline each account once`() {
        val accounts = List(4) { legacyAccount() }
        val start = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(2)
        val runs =
            List(2) {
                pool.submit<Int> {
                    start.await()
                    job.run()
                }
            }

        start.countDown()
        runs.forEach { it.get(60, TimeUnit.SECONDS) }
        pool.shutdown()

        for ((user, scope) in accounts) {
            assertEquals(1, head(scope), "account $user")
            assertEquals(owned(user), replica(scope))
            assertEquals(1, baselineVersion(user))
        }
    }

    @Test
    fun `a restore starts the scope over, so devices reset onto the restored rows`() {
        seed()
        val backup = getJson("/api/v1/data/export")
        val cursorEpoch = epoch()
        val cursorVersion = head()

        post("/api/v1/data/import", backup).andExpect { status { isNoContent() } }

        assertNotEquals(cursorEpoch, epoch())
        assertEquals(cursorEpoch + 1, epoch())
        assertEquals(head(), baselineVersion())
        assertEquals(owned(), replica())
        val baseline = replica(after = head() - 1)
        assertEquals(owned(), baseline)
        assertTrue(head() > cursorVersion)
    }

    @Test
    fun `a refused restore leaves the scope alone`() {
        seed()
        val before = epoch() to head()

        expectProblem(post("/api/v1/data/import", mapOf("format" to "nope")), 422, "invalid")

        assertEquals(before, epoch() to head())
    }

    private companion object {
        val DAY: LocalDate = LocalDate.of(2026, 11, 2)
    }
}
