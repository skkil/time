package com.skkil.time.migration

import com.skkil.time.common.id.UuidV5
import com.skkil.time.support.Postgres
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** V15 renames every natural-key row to `UuidV5(scope, "<table>/<key>")`, leaving every link intact. */
class NaturalKeyMigrationTest {
    private lateinit var jdbc: JdbcClient
    private lateinit var url: String

    @BeforeEach
    fun freshDatabase() {
        val container = Postgres.container.apply { start() }
        val name = "natural_${UUID.randomUUID().toString().replace("-", "")}"
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

    /** Each natural-key row as (table, id, the name its id must be derived from). */
    private fun rows(): List<Triple<String, UUID, String>> =
        jdbc
            .sql(
                """
                SELECT 'setting' AS tbl, s.id, 'setting/' || s.key AS name FROM setting s
                UNION ALL SELECT 'project_canvas', id, 'project_canvas/' || project_id FROM project_canvas
                UNION ALL SELECT 'week', id, 'week/' || start_date FROM week
                UNION ALL SELECT 'day', id, 'day/' || date FROM day
                UNION ALL SELECT 'task_dependency', id, 'task_dependency/' || task_id || '/' || blocked_by_id
                  FROM task_dependency
                UNION ALL SELECT 'record_phase', id, 'record_phase/' || task_id || '/' || status_id FROM record_phase
                UNION ALL SELECT 'running_timer', id, 'running_timer' FROM running_timer
                UNION ALL SELECT 'habit_log', id, 'habit_log/' || habit_id || '/' || date FROM habit_log
                UNION ALL SELECT 'ritual', id, 'ritual/' || kind FROM ritual
                UNION ALL SELECT 'user_preference', id, 'user_preference' FROM user_preference
                """,
            ).query { rs, _ -> Triple(rs.getString("tbl"), rs.getObject("id", UUID::class.java), rs.getString("name")) }
            .list()

    private fun scope(): UUID = jdbc.sql("SELECT scope_id FROM app_user WHERE id = 1").query(UUID::class.java).single()

    @Test
    fun `natural-key rows take their derived ids`() {
        migrate("7")
        jdbc.sql(javaClass.getResource("/db/v7/seed.sql")!!.readText()).update()
        migrate("14")
        val before = rows()
        assertEquals(10, before.map { it.first }.toSet().size)
        assertTrue(before.filter { it.first != "ritual" }.none { it.second == UuidV5.of(scope(), it.third) })

        migrate("latest")

        val after = rows()
        assertEquals(
            before.map {
                "${it.first} ${it.third}"
            }.sorted(),
            after.map { "${it.first} ${it.third}" }.sorted(),
        )
        for ((table, id, name) in after) assertEquals(UuidV5.of(scope(), name), id, "$table $name")
    }
}
