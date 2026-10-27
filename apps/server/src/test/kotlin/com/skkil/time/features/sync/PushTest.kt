package com.skkil.time.features.sync

import com.google.protobuf.ByteString
import com.skkil.time.common.clock.Hlc
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.features.tasks.api.TaskIds
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.skkil.store.push.DerivedIds
import org.skkil.store.v1.Mutation
import org.skkil.store.v1.MutationResult.Status
import org.skkil.store.v1.PushRequest
import org.skkil.store.v1.PushResponse
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.post
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PushTest : TaskApiTest() {
    private val client = UUID.randomUUID()
    private val acted = Instant.parse("2026-03-04T05:06:07Z")

    private fun mutation(id: Long, name: String, args: Map<String, Any?>, hlc: Long = Hlc.of(acted.toEpochMilli(), 0)) =
        Mutation
            .newBuilder()
            .setMutationId(id)
            .setName(name)
            .setArgs(ByteString.copyFrom(mapper.writeValueAsBytes(args)))
            .setHlc(hlc)
            .build()

    private fun send(client: UUID, vararg mutations: Mutation): ResultActionsDsl {
        val request =
            PushRequest
                .newBuilder()
                .setProtocolVersion(1)
                .setClientId(client.toString())
                .addAllMutations(mutations.toList())
                .build()
        return mvc.post("/skkil.store.v1.PushService/Push") {
            with(token())
            contentType = MediaType("application", "proto")
            content = request.toByteArray()
        }
    }

    private fun push(vararg mutations: Mutation): PushResponse {
        val response = send(client, *mutations).andExpect { status { isOk() } }.andReturn().response
        return PushResponse.parseFrom(response.contentAsByteArray)
    }

    private fun createTask(id: Long, title: String) = mutation(id, "createTask", mapOf("input" to input(title)))

    private fun changes(): Long = getJson("/api/v1/changes")["version"].asLong()

    @Test
    fun `applies a mutation with the device's ids and clock, once`() {
        val before = changes()
        val first = push(createTask(1, "Draft")).resultsList.single()
        assertEquals(Status.STATUS_APPLIED, first.status)

        val id = DerivedIds.derive(client, 1, 0)
        val task = task(id)
        assertEquals("Draft", task["title"].asString())
        assertEquals(acted.epochSecond, task["createdAt"].asLong())
        assertEquals(before + 1, changes())
        assertEquals(client.toString(), getJson("/api/v1/changes")["lastWriter"].asString())

        val again = push(createTask(1, "Draft")).resultsList.single()
        assertEquals(Status.STATUS_DUPLICATE, again.status)
        assertEquals(first.version, again.version)
        assertEquals(1, getJson("/api/v1/tasks").size())
    }

    @Test
    fun `two devices creating the same week offline converge on one row id`() {
        val monday = "2026-11-02"
        val laptop = UUID.randomUUID()
        val phone = UUID.randomUUID()
        for ((device, worked) in listOf(laptop to "from the laptop", phone to "from the phone")) {
            val notes = mapOf("worked" to worked, "fellShort" to "", "change" to "")
            val pushed = send(device, mutation(1, "saveWeekNotes", mapOf("date" to monday, "notes" to notes)))
            val result = PushResponse.parseFrom(pushed.andReturn().response.contentAsByteArray).resultsList.single()
            assertEquals(Status.STATUS_APPLIED, result.status)
        }

        val id = NaturalIds.week(scopeId(), LocalDate.parse(monday))
        val weeks =
            jdbc
                .sql("SELECT id, worked FROM week WHERE user_id = :user")
                .param("user", userId())
                .query { rs, _ -> rs.getObject("id", UUID::class.java) to rs.getString("worked") }
                .list()
        assertEquals(listOf(id to "from the phone"), weeks)
        val logged =
            jdbc
                .sql("SELECT DISTINCT row_id FROM store_log WHERE scope_id = :scope AND table_name = 'week'")
                .param("scope", scopeId())
                .query(String::class.java)
                .list()
        assertEquals(listOf(id.toString()), logged)
    }

    @Test
    fun `rejects broken rules with their message and keeps going`() {
        val results =
            push(
                createTask(1, " "),
                mutation(2, "dropDatabase", emptyMap()),
                mutation(3, "deleteTask", mapOf("id" to UUID.randomUUID())),
                createTask(4, "Kept"),
            ).resultsList

        assertEquals(
            listOf(Status.STATUS_REJECTED, Status.STATUS_REJECTED, Status.STATUS_REJECTED, Status.STATUS_APPLIED),
            results.map { it.status },
        )
        assertTrue(results[0].reason.endsWith("can't be empty."), results[0].reason)
        assertEquals("unknown mutation: dropDatabase", results[1].reason)
        assertEquals("Task not found.", results[2].reason)
        assertEquals(listOf("Kept"), getJson("/api/v1/tasks").values().map { it["title"].asString() })
        val rejection =
            jdbc
                .sql(
                    "SELECT data ->> 'reason' FROM store_log WHERE scope_id = :scope AND kind = 'rejection' ORDER BY version",
                )
                .param("scope", scopeId())
                .query(String::class.java)
                .list()
        assertEquals(results.take(3).map { it.reason }, rejection.filterNotNull())
    }

    @Test
    fun `a pushed version holds the rows, without the owner column`() {
        val result = push(createTask(1, "Read")).resultsList.single()
        val rows =
            jdbc
                .sql(
                    """
                    SELECT table_name, row_id, op, data::text AS data, client_id, mutation_id FROM store_log
                    WHERE scope_id = :scope AND version = :version AND kind = 'patch' ORDER BY seq
                    """,
                ).param("scope", scopeId())
                .param("version", result.version)
                .query { rs, _ ->
                    listOf(rs.getString("table_name"), rs.getString("row_id"), rs.getString("op")) to
                        Triple(
                            rs.getString("data"),
                            rs.getObject("client_id", UUID::class.java),
                            rs.getLong("mutation_id"),
                        )
                }.list()

        assertEquals(
            setOf(listOf("task", DerivedIds.derive(client, 1, 0).toString(), "upsert")),
            rows.map {
                it.first
            }.toSet(),
        )
        val details = rows.last().second
        val data = mapper.readTree(details.first)
        assertEquals("Read", data["title"].asString())
        assertFalse(data.has("user_id"))
        assertFalse(data.has("reminded_for"))
        assertEquals(client, details.second)
        assertEquals(1, details.third)
    }

    @Test
    fun `a mutation without a clock acts at the server's time`() {
        val before = Instant.now().epochSecond
        push(mutation(1, "createTask", mapOf("input" to input("Now")), hlc = 0))
        assertTrue(task(DerivedIds.derive(client, 1, 0))["createdAt"].asLong() >= before)
    }

    @Test
    fun `a client of another account is refused`() {
        push(createTask(1, "Mine"))
        subject = UUID.randomUUID().toString()
        send(client, createTask(1, "Theirs")).andExpect {
            status { isForbidden() }
            jsonPath("$.code") { value("permission_denied") }
        }
        assertEquals(0, getJson("/api/v1/tasks").size())
    }

    @Test
    fun `answers Connect JSON too`() {
        val body =
            mapOf(
                "protocolVersion" to 1,
                "clientId" to client.toString(),
                "mutations" to
                    listOf(
                        mapOf(
                            "mutationId" to "1",
                            "name" to "createTask",
                            "args" to
                                java.util.Base64
                                    .getEncoder()
                                    .encodeToString(mapper.writeValueAsBytes(mapOf("input" to input("Json")))),
                        ),
                    ),
            )
        mvc
            .post("/skkil.store.v1.PushService/Push") {
                with(token())
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(body)
            }.andExpect {
                status { isOk() }
                jsonPath("$.results[0].status") { value("STATUS_APPLIED") }
            }
    }

    @Test
    fun `needs the API's sign-in`() {
        mvc
            .post("/skkil.store.v1.PushService/Push") {
                contentType = MediaType("application", "proto")
                content = PushRequest.getDefaultInstance().toByteArray()
            }.andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `undo replays from the snapshot the device kept`() {
        val task = create(input("Keep me")).id()
        val snapshot = postJson("/api/v1/undo/capture", TaskIds(listOf(task)))
        delete("/api/v1/tasks/$task").andExpect { status { isNoContent() } }

        val result = push(mutation(1, "restoreTasks", mapOf("snapshot" to snapshot))).resultsList.single()

        assertEquals(Status.STATUS_APPLIED, result.status)
        assertEquals("Keep me", task(task)["title"].asString())
    }

    @Test
    fun `device-only commands are not pushable`() {
        val result = push(mutation(1, "syncHabits", emptyMap())).resultsList.single()
        assertEquals(Status.STATUS_REJECTED, result.status)
        assertEquals("unknown mutation: syncHabits", result.reason)
    }
}
