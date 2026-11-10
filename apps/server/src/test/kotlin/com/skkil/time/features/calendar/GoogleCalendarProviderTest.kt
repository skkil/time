package com.skkil.time.features.calendar

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.features.calendar.provider.EventWindow
import com.skkil.time.features.calendar.provider.GoogleCalendarProvider
import com.skkil.time.features.calendar.provider.ProviderException
import com.skkil.time.features.calendar.provider.ProviderException.Reason
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.databind.json.JsonMapper
import java.net.InetSocketAddress
import java.net.URLDecoder
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.Base64
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Google's protocol against a local stand-in: no request leaves this machine. */
class GoogleCalendarProviderTest {
    private val requests = mutableListOf<String>()
    private val server =
        HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/") { exchange -> answer(exchange) }
            start()
        }
    private val base = "http://127.0.0.1:${server.address.port}"
    private val now = Instant.parse("2026-11-10T00:00:00Z")
    private val google =
        GoogleCalendarProvider(
            "client",
            "secret",
            "https://time.example/api/v1/calendar/google/callback",
            JsonMapper.builder().build(),
            MutationClock { now },
            GoogleCalendarProvider.Endpoints("$base/auth", "$base/token", "$base/revoke", "$base/api"),
        )

    @AfterEach
    fun stop() = server.stop(0)

    private fun answer(exchange: HttpExchange) {
        val uri = exchange.requestURI
        val body = exchange.requestBody.readAllBytes().decodeToString()
        val auth = exchange.requestHeaders.getFirst("Authorization").orEmpty()
        requests += "${exchange.requestMethod} ${uri.rawPath}?${uri.rawQuery.orEmpty()} $body $auth"
        val query =
            uri.rawQuery.orEmpty().split('&').filter { it.isNotEmpty() }.associate {
                val (name, value) = it.split('=', limit = 2)
                name to URLDecoder.decode(value, Charsets.UTF_8)
            }
        val (status, reply) =
            when {
                uri.path == "/token" && "refresh_token=gone" in body -> {
                    400 to """{"error":"invalid_grant"}"""
                }

                uri.path == "/token" -> {
                    200 to tokenReply(body)
                }

                uri.path == "/revoke" -> {
                    200 to ""
                }

                uri.path.endsWith("/calendarList") && query["pageToken"] == null -> {
                    200 to
                        """{"items":[{"id":"ada@example.com","summary":"Ada","backgroundColor":"#9fe1e7","primary":true}],"nextPageToken":"p2"}"""
                }

                uri.path.endsWith("/calendarList") -> {
                    200 to
                        """{"items":[{"id":"en.south_korea#holiday@group.v.calendar.google.com","summary":"Holidays","summaryOverride":"Korean holidays"}]}"""
                }

                uri.path.endsWith("/events") && query["syncToken"] == "expired" -> {
                    410 to """{"error":{"code":410}}"""
                }

                uri.path.endsWith("/events") && query["syncToken"] == "busy" -> {
                    403 to
                        """{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}"""
                }

                uri.path.endsWith("/events") -> {
                    200 to EVENTS
                }

                else -> {
                    404 to "{}"
                }
            }
        val bytes = reply.toByteArray()
        exchange.sendResponseHeaders(status, if (bytes.isEmpty()) -1 else bytes.size.toLong())
        if (bytes.isNotEmpty()) exchange.responseBody.use { it.write(bytes) }
        exchange.close()
    }

    private fun tokenReply(body: String): String {
        val identity = """{"sub":"1077","email":"ada@example.com"}"""
        val claims = Base64.getUrlEncoder().withoutPadding().encodeToString(identity.toByteArray())
        return if ("authorization_code" in body) {
            """{"access_token":"a1","expires_in":3599,"refresh_token":"r1","id_token":"h.$claims.s"}"""
        } else {
            """{"access_token":"a2","expires_in":3599}"""
        }
    }

    @Test
    fun `asks for read-only calendar access with PKCE and offline access`() {
        val url = UriComponentsBuilder.fromUriString(google.authorizeUrl("st", "ch")).build()
        val query = url.queryParams.toSingleValueMap().mapValues { URLDecoder.decode(it.value, Charsets.UTF_8) }
        assertEquals("$base/auth", "${url.scheme}://${url.host}:${url.port}${url.path}")
        assertEquals(GoogleCalendarProvider.SCOPES.joinToString(" "), query["scope"])
        assertTrue(GoogleCalendarProvider.SCOPES.all { it == "openid" || it == "email" || it.endsWith(".readonly") })
        assertEquals("S256", query["code_challenge_method"])
        assertEquals("ch", query["code_challenge"])
        assertEquals("offline", query["access_type"])
        assertEquals("st", query["state"])
        assertEquals("https://time.example/api/v1/calendar/google/callback", query["redirect_uri"])
    }

    @Test
    fun `trades a code for tokens and the account, and refreshes`() {
        val tokens = google.exchange("code", "verifier")
        assertEquals("a1", tokens.accessToken)
        assertEquals("r1", tokens.refreshToken)
        assertEquals(now.epochSecond + 3599, tokens.expiresAt)
        assertEquals("1077", tokens.subject)
        assertEquals("ada@example.com", tokens.email)
        assertTrue(requests.single().contains("code_verifier=verifier"))

        val fresh = google.refresh("r1")
        assertEquals("a2", fresh.accessToken)
        assertNull(fresh.refreshToken)
        assertEquals(Reason.REVOKED, assertFailsWith<ProviderException> { google.refresh("gone") }.reason)
    }

    @Test
    fun `lists calendars across pages, primary marked`() {
        val calendars = google.calendars("a1")
        assertEquals(listOf("Ada", "Korean holidays"), calendars.map { it.name })
        assertTrue(calendars[0].primary)
        assertEquals(GoogleCalendarProvider.DEFAULT_COLOR, calendars[1].color)
        assertTrue(requests.all { it.endsWith("Bearer a1") })
    }

    @Test
    fun `reads one instance per event, all-day by date, and maps failures`() {
        val window = EventWindow(now.minusSeconds(86_400), now.plusSeconds(86_400 * 7))
        val page = google.events("a1", "en.south_korea#holiday@group.v.calendar.google.com", window, null)
        assertTrue(page.full)
        assertEquals("s1", page.syncToken)
        assertTrue(
            requests.last().contains("/api/calendars/en.south_korea%23holiday@group.v.calendar.google.com/events"),
        )
        assertTrue(requests.last().contains("singleEvents=true") && requests.last().contains("timeMin="))
        val (standup, offsite, gone) = page.events
        assertEquals("Standup", standup.title)
        assertEquals(Instant.parse("2026-11-10T00:30:00Z").epochSecond, standup.start)
        assertEquals("Room 4", standup.location)
        assertEquals("https://www.google.com/calendar/event?eid=abc", standup.link)
        assertTrue(offsite.allDay)
        assertEquals(LocalDate.parse("2026-11-12").atStartOfDay(ZoneOffset.UTC).toEpochSecond(), offsite.start)
        assertEquals(LocalDate.parse("2026-11-13").atStartOfDay(ZoneOffset.UTC).toEpochSecond(), offsite.end)
        assertEquals("(No title)", offsite.title)
        assertTrue(gone.cancelled)

        val next = google.events("a1", "ada@example.com", window, "s0")
        assertTrue(!next.full && requests.last().contains("syncToken=s0") && !requests.last().contains("timeMin"))
        assertEquals(
            Reason.RESYNC,
            assertFailsWith<ProviderException> {
                google.events("a1", "x", window, "expired")
            }.reason,
        )
        assertEquals(
            Reason.RETRY,
            assertFailsWith<ProviderException> {
                google.events("a1", "x", window, "busy")
            }.reason,
        )
        google.revoke("r1")
        assertTrue(requests.last().startsWith("POST /revoke") && requests.last().contains("token=r1"))
    }

    private companion object {
        const val EVENTS =
            """
            {"items":[
              {"id":"abc_20261110T003000Z","status":"confirmed","summary":"Standup","location":"Room 4",
               "htmlLink":"https://www.google.com/calendar/event?eid=abc","updated":"2026-11-09T10:00:00.000Z",
               "start":{"dateTime":"2026-11-10T09:30:00+09:00"},"end":{"dateTime":"2026-11-10T09:45:00+09:00"}},
              {"id":"offsite","status":"confirmed","start":{"date":"2026-11-12"},"end":{"date":"2026-11-13"}},
              {"id":"moved","status":"cancelled"}
            ],"nextSyncToken":"s1"}
            """
    }
}
