package com.skkil.time.features.sync

import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class ServerWriteTest : TaskApiTest() {
    private val server = UUID(0, 0)

    private data class Logged(
        val version: Long,
        val table: String?,
        val rowId: String?,
        val client: UUID,
        val data: String?,
    )

    private fun log(scope: UUID = scopeId()): List<Logged> =
        jdbc
            .sql(
                """
                SELECT version, table_name, row_id, client_id, data::text AS data FROM store_log
                WHERE scope_id = :scope AND kind = 'patch' ORDER BY version, seq
                """,
            ).param("scope", scope)
            .query { rs, _ ->
                Logged(
                    rs.getLong("version"),
                    rs.getString("table_name"),
                    rs.getString("row_id"),
                    rs.getObject("client_id", UUID::class.java),
                    rs.getString("data"),
                )
            }.list()

    private fun head(): Long =
        jdbc
            .sql("SELECT coalesce((SELECT head_version FROM store_scope WHERE scope_id = :scope), 0)")
            .param("scope", scopeId())
            .query(Long::class.java)
            .single()

    @Test
    fun `a new account's seeded rituals are one server write`() {
        val seeded = log()
        assertEquals(setOf("ritual"), seeded.map { it.table }.toSet())
        assertEquals(5, seeded.size)
        assertEquals(setOf(server), seeded.map { it.client }.toSet())
        assertEquals(1, seeded.map { it.version }.toSet().size)
    }

    @Test
    fun `a REST write is logged as a server write without the owner column`() {
        val before = head()
        val project = project("Home")

        assertEquals(before + 1, head())
        val logged = log().filter { it.version == before + 1 }
        assertEquals(listOf("project" to project.toString()), logged.map { it.table to it.rowId })
        assertEquals(server, logged.single().client)
        val data = mapper.readTree(logged.single().data)
        assertEquals("Home", data["name"].asString())
        assertFalse(data.has("user_id"))
    }

    @Test
    fun `one request with several changes is one version`() {
        val project = project("Home")
        val parent = create(input("Parent", project)).id()
        create(input("Child", project).copy(parentId = parent))
        val before = head()

        delete("/api/v1/projects/$project").andExpect { status { is2xxSuccessful() } }

        assertEquals(before + 1, head())
        val deleted = log().filter { it.version == before + 1 }
        assertEquals(setOf("project", "task"), deleted.map { it.table }.toSet())
        assertEquals(3, deleted.size)
    }

    @Test
    fun `a refused write logs nothing`() {
        val before = head()
        expectProblem(post("/api/v1/projects", ProjectInput(" ", null, "teal")), 422, "invalid")
        assertEquals(before, head())
    }

    @Test
    fun `a write that changes no synced row logs no version`() {
        val before = head()
        postJson("/api/v1/habits/sync")
        assertEquals(before, head())
    }

    @Test
    fun `deleting the account logs its rows away and drops its scope`() {
        project("Home")
        val scope = scopeId()
        delete("/api/v1/me").andExpect { status { isNoContent() } }

        assertEquals(emptyList(), log(scope))
        assertEquals(
            0,
            jdbc
                .sql("SELECT count(*) FROM store_scope WHERE scope_id = :scope")
                .param("scope", scope)
                .query(Int::class.java)
                .single(),
        )
    }
}
