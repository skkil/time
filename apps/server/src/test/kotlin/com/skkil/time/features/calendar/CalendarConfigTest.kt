package com.skkil.time.features.calendar

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.error.DomainException
import com.skkil.time.config.AppProperties
import com.skkil.time.config.CalendarConfig
import com.skkil.time.features.calendar.provider.FakeCalendarProvider
import com.skkil.time.features.calendar.provider.GoogleCalendarProvider
import com.skkil.time.features.calendar.service.TokenCipher
import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.Base64
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class CalendarConfigTest {
    private val clock = MutationClock { Instant.parse("2026-11-10T00:00:00Z") }
    private val key = Base64.getEncoder().encodeToString(ByteArray(32) { it.toByte() })

    private fun connector(calendar: AppProperties.Calendar) =
        CalendarConfig().calendarConnector(AppProperties(calendar = calendar), JsonMapper.builder().build(), clock)

    @Test
    fun `google stays off until its client and the token key are all set`() {
        for (missing in listOf("id", "secret", "key")) {
            val off =
                connector(
                    AppProperties.Calendar(
                        googleClientId = if (missing == "id") "" else "client",
                        googleClientSecret = if (missing == "secret") "" else "secret",
                        tokenKey = if (missing == "key") "" else key,
                    ),
                )
            assertFalse(off.available, missing)
            assertEquals(
                "Calendars aren't set up on this server.",
                assertFailsWith<DomainException> { off.provider }.message,
            )
        }
        val on =
            connector(AppProperties.Calendar(googleClientId = "client", googleClientSecret = "secret", tokenKey = key))
        assertTrue(on.available)
        assertIs<GoogleCalendarProvider>(on.provider)
    }

    @Test
    fun `the fake needs no credentials`() {
        val fake = connector(AppProperties.Calendar(provider = "fake"))
        assertTrue(fake.available)
        assertIs<FakeCalendarProvider>(fake.provider)
    }

    @Test
    fun `tokens are sealed with a fresh nonce and refuse tampering or another key`() {
        val cipher = TokenCipher.fromBase64(key)
        val sealed = cipher.encrypt("1//refresh-token")
        assertNotEquals(sealed, cipher.encrypt("1//refresh-token"))
        assertFalse(sealed.contains("refresh"))
        assertEquals("1//refresh-token", cipher.decrypt(sealed))

        val bytes = Base64.getDecoder().decode(sealed).also { it[it.size - 1] = (it.last() + 1).toByte() }
        assertFailsWith<Exception> { cipher.decrypt(Base64.getEncoder().encodeToString(bytes)) }
        assertFailsWith<Exception> { TokenCipher.random().decrypt(sealed) }
        assertFailsWith<IllegalArgumentException> { TokenCipher(ByteArray(16)) }
    }
}
