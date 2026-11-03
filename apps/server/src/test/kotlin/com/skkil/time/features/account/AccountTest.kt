package com.skkil.time.features.account

import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.get
import kotlin.test.assertEquals

class AccountTest : ApiTest() {
    @Test
    fun `creates the user on first request and seeds rituals`() {
        val id = userId()
        assertEquals(id, userId())
        val rituals =
            jdbc.sql(
                "SELECT count(*) FROM ritual WHERE user_id = :id",
            ).param("id", id).query(Long::class.java).single()
        assertEquals(5, rituals)
    }

    @Test
    fun `remembers the time zone the client sends`() {
        zone = "Asia/Seoul"
        assertEquals("Asia/Seoul", getJson("/api/v1/me")["timeZone"].asString())
    }

    @Test
    fun `names the store scope the account syncs in`() {
        assertEquals(scopeId().toString(), getJson("/api/v1/me")["scopeId"].asString())
    }

    @Test
    fun `rejects requests without a token`() {
        mvc.get("/api/v1/me").andExpect {
            status { isUnauthorized() }
            jsonPath("$.kind") { value("unauthorized") }
        }
    }

    @Test
    fun `answers unknown routes as not found`() {
        expectProblem(get("/api/v1/no-such-route"), 404, "notFound")
    }

    @Test
    fun `deletes the account and everything it owns`() {
        val id = userId()
        delete("/api/v1/me").andExpect { status { isNoContent() } }
        val left =
            jdbc.sql(
                "SELECT count(*) FROM app_user WHERE id = :id",
            ).param("id", id).query(Long::class.java).single()
        assertEquals(0, left)
    }
}
