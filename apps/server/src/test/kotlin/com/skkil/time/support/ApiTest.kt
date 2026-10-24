package com.skkil.time.support

import com.skkil.time.features.sync.service.ServerWrites
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

/**
 * Base for HTTP-level tests: a real Postgres, the full Spring context, and a fresh signed-in user per test.
 * Requests send `X-Time-Zone: UTC` unless a test sets [zone].
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(Postgres::class)
abstract class ApiTest {
    @Autowired lateinit var mvc: MockMvc

    @Autowired lateinit var mapper: JsonMapper

    @Autowired lateinit var jdbc: JdbcClient

    @Autowired lateinit var writes: ServerWrites

    var subject: String = ""
    var zone: String = "UTC"

    @BeforeEach
    fun newUser() {
        subject = UUID.randomUUID().toString()
    }

    fun token() =
        jwt().jwt { it.subject(subject).issuer("https://issuer.test/").claim("email", "$subject@example.com") }

    fun getJson(path: String): JsonNode = read(get(path))

    fun get(path: String): ResultActionsDsl =
        mvc.get(path) {
            with(token())
            header("X-Time-Zone", zone)
        }

    fun post(path: String, body: Any? = null): ResultActionsDsl =
        mvc.post(path) {
            with(token())
            header("X-Time-Zone", zone)
            body?.let {
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(it)
            }
        }

    fun put(path: String, body: Any? = null): ResultActionsDsl =
        mvc.put(path) {
            with(token())
            header("X-Time-Zone", zone)
            body?.let {
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(it)
            }
        }

    fun delete(path: String, body: Any? = null): ResultActionsDsl =
        mvc.delete(path) {
            with(token())
            header("X-Time-Zone", zone)
            body?.let {
                contentType = MediaType.APPLICATION_JSON
                content = mapper.writeValueAsString(it)
            }
        }

    fun read(result: ResultActionsDsl): JsonNode {
        val response = result.andExpect { status { is2xxSuccessful() } }.andReturn().response
        return mapper.readTree(response.contentAsString.ifEmpty { "null" })
    }

    fun postJson(path: String, body: Any? = null): JsonNode = read(post(path, body))

    fun putJson(path: String, body: Any? = null): JsonNode = read(put(path, body))

    fun deleteJson(path: String, body: Any? = null): JsonNode = read(delete(path, body))

    fun expectProblem(result: ResultActionsDsl, status: Int, kind: String) {
        result.andExpect {
            status { isEqualTo(status) }
            jsonPath("$.kind") { value(kind) }
        }
    }

    fun userId(): Long = getJson("/api/v1/me")["id"].asLong()

    /** Runs direct SQL on synced tables as a server write in the current user's scope. */
    fun <T> asServer(block: () -> T): T = writes.run(scopeId(), block)

    fun scopeId(): UUID =
        jdbc.sql("SELECT scope_id FROM app_user WHERE id = :id").param("id", userId()).query(UUID::class.java).single()

    fun JsonNode.id(): UUID = uuid("id")

    fun JsonNode.uuid(field: String): UUID = UUID.fromString(this[field].asString())

    fun JsonNode.uuidOrNull(field: String): UUID? =
        this[field].takeUnless {
            it.isNull
        }?.let { UUID.fromString(it.asString()) }

    fun JsonNode.uuids(field: String): List<UUID> = this[field].values().map { UUID.fromString(it.asString()) }

    fun JsonNode.asUuid(): UUID = UUID.fromString(asString())
}
