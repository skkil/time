package com.skkil.time.migration

import com.skkil.time.support.Postgres
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Data written under the bigint schema (V7) survives V8 with every link intact. */
class UuidMigrationTest {
    private lateinit var jdbc: JdbcClient
    private lateinit var url: String

    @BeforeEach
    fun freshDatabase() {
        val container = Postgres.container.apply { start() }
        val name = "migration_${UUID.randomUUID().toString().replace("-", "")}"
        JdbcClient.create(DriverManagerDataSource(container.jdbcUrl, container.username, container.password))
            .sql("CREATE DATABASE $name")
            .update()
        url = container.jdbcUrl.replaceAfterLast('/', name)
        jdbc = JdbcClient.create(DriverManagerDataSource(url, container.username, container.password))
    }

    private fun migrate(target: String) {
        val container = Postgres.container
        Flyway
            .configure()
            .dataSource(url, container.username, container.password)
            .target(target)
            .load()
            .migrate()
    }

    private fun text(sql: String): List<String?> = jdbc.sql(sql).query(String::class.java).list()

    @Test
    fun `old rows keep their links under uuid ids`() {
        migrate("7")
        jdbc.sql(javaClass.getResource("/db/v7/seed.sql")!!.readText()).update()

        migrate("latest")

        assertEquals(
            listOf("P/Child"),
            text("SELECT p.name || '/' || c.name FROM project c JOIN project p ON p.id = c.parent_id"),
        )
        assertEquals(listOf("G"), text("SELECT g.name FROM project p JOIN project_group g ON g.id = p.group_id"))
        assertEquals(
            listOf("T2>T1"),
            text(
                "SELECT t.title || '>' || b.title FROM task_dependency d " +
                    "JOIN task t ON t.id = d.task_id JOIN task b ON b.id = d.blocked_by_id",
            ),
        )
        assertEquals(
            listOf("T1|S|Todo|Bug|v1|O"),
            text(
                """
                SELECT t.title || '|' || s.name || '|' || st.name || '|' || ty.name || '|' || m.name || '|' || o.title
                FROM task t JOIN section s ON s.id = t.section_id JOIN item_status st ON st.id = t.status_id
                JOIN item_type ty ON ty.id = t.type_id JOIN milestone m ON m.id = t.milestone_id
                JOIN outcome o ON o.id = t.outcome_id
                """,
            ),
        )
        assertEquals(listOf("T1"), text("SELECT t.title FROM task c JOIN task t ON t.id = c.parent_id"))
        assertEquals(
            listOf("Pr|2026-11-02"),
            text(
                "SELECT p.title || '|' || w.start_date FROM outcome o JOIN priority p ON p.id = o.priority_id JOIN week w ON w.user_id = o.user_id AND w.start_date = o.week_start",
            ),
        )
        assertEquals(
            listOf("n|Todo"),
            text(
                "SELECT r.notes || '|' || s.name FROM record_phase r JOIN item_status s ON s.id = r.status_id JOIN task t ON t.id = r.task_id",
            ),
        )
        assertEquals(
            listOf("T1|P"),
            text(
                "SELECT t.title || '|' || p.name FROM time_entry e JOIN task t ON t.id = e.task_id JOIN project p ON p.id = e.project_id",
            ),
        )
        assertEquals(listOf("T1"), text("SELECT t.title FROM time_block b JOIN task t ON t.id = b.task_id"))
        assertEquals(listOf("T2"), text("SELECT t.title FROM running_timer r JOIN task t ON t.id = r.task_id"))
        assertEquals(listOf("P"), text("SELECT p.name FROM habit h JOIN project p ON p.id = h.track_project_id"))
        assertEquals(listOf("H"), text("SELECT h.name FROM habit_log l JOIN habit h ON h.id = l.habit_id"))
        assertEquals(
            listOf("T1"),
            text(
                "SELECT t.title FROM ritual_run r JOIN task t ON t.id = r.task_id JOIN ritual k ON k.user_id = r.user_id AND k.kind = r.kind",
            ),
        )
        assertEquals(listOf("hi"), text("SELECT c.content FROM project_canvas c JOIN project p ON p.id = c.project_id"))
        assertEquals(emptyList(), text("SELECT tablename::TEXT FROM pg_tables WHERE tablename = 'undo_snapshot'"))
        assertEquals(listOf("1"), text("SELECT COUNT(*)::TEXT FROM push_device"))
    }

    @Test
    fun `ids become ordered uuid v7 and every synced table has a uuid key`() {
        migrate("7")
        jdbc.sql(javaClass.getResource("/db/v7/seed.sql")!!.readText()).update()
        migrate("latest")

        val projects = text("SELECT id::TEXT FROM project ORDER BY name = 'Other', name <> 'P'").filterNotNull()
        assertEquals(3, projects.size)
        assertTrue(projects.all { UUID.fromString(it).version() == 7 })
        assertEquals(projects.sorted(), projects)
        val uuidKeys =
            text(
                """
                SELECT c.table_name FROM information_schema.columns c
                JOIN information_schema.table_constraints k
                  ON k.table_name = c.table_name AND k.constraint_type = 'PRIMARY KEY'
                JOIN information_schema.key_column_usage u
                  ON u.constraint_name = k.constraint_name AND u.column_name = c.column_name
                WHERE c.table_schema = current_schema() AND c.column_name = 'id' AND c.data_type = 'uuid'
                """,
            ).filterNotNull().toSet()
        val synced =
            setOf(
                "project_group",
                "project",
                "project_canvas",
                "section",
                "item_type",
                "item_status",
                "milestone",
                "saved_view",
                "quarter",
                "priority",
                "week",
                "outcome",
                "day",
                "task",
                "task_dependency",
                "record_phase",
                "time_block",
                "time_entry",
                "running_timer",
                "habit",
                "habit_log",
                "ritual",
                "ritual_run",
                "setting",
                "user_preference",
                "calendar_account",
                "calendar_source",
                "calendar_event",
            )
        assertEquals(synced, uuidKeys)
        assertEquals(2, text("SELECT DISTINCT scope_id::TEXT FROM app_user").size)
        jdbc.sql(
            "SET store.bypass = on; " +
                "INSERT INTO week (id, user_id, start_date) VALUES (gen_random_uuid(), 1, '2026-11-02') ON CONFLICT DO NOTHING",
        ).update()
        assertEquals(listOf("1"), text("SELECT COUNT(*)::TEXT FROM week"))
    }
}
