package com.skkil.time.features.preferences

import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.patch
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PreferenceTest : ApiTest() {
    private fun patch(body: Map<String, Any?>): ResultActionsDsl =
        mvc.patch("/api/v1/preferences") {
            with(jwt().jwt { it.subject(subject).issuer("https://issuer.test/") })
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(body)
        }

    @Test
    fun `merges, keeps nested values and removes nulls`() {
        assertEquals(0, getJson("/api/v1/preferences").size())
        read(patch(mapOf("profileName" to "Alex", "sleep" to mapOf("start" to 1380, "end" to 420))))
        val merged = read(patch(mapOf("weekStartsOn" to 0, "profileName" to null)))
        assertTrue(merged["profileName"] == null)
        assertEquals(0, merged["weekStartsOn"].asInt())
        assertEquals(1380, getJson("/api/v1/preferences")["sleep"]["start"].asInt())
    }

    @Test
    fun `refuses oversized preferences`() {
        expectProblem(patch(mapOf("note" to "x".repeat(40_000))), 422, "invalid")
        expectProblem(patch(mapOf("k".repeat(65) to 1)), 422, "invalid")
    }

    @Test
    fun `keeps each user's preferences apart`() {
        read(patch(mapOf("profileName" to "Alex")))
        subject = UUID.randomUUID().toString()
        assertEquals(0, getJson("/api/v1/preferences").size())
    }
}
