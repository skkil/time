package com.skkil.time.features.calendar.provider

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.features.calendar.provider.ProviderException.Reason
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.io.IOException
import java.net.URI
import java.net.http.HttpClient
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Base64

/**
 * Google Calendar over its REST API: OAuth 2.0 with PKCE and offline access, the calendar list, and events with
 * `singleEvents=true`, so each instance of a repeating event is its own event.
 */
class GoogleCalendarProvider(
    private val clientId: String,
    private val clientSecret: String,
    private val redirectUri: String,
    private val mapper: JsonMapper,
    private val clock: MutationClock,
    private val endpoints: Endpoints = Endpoints(),
) : CalendarProvider {
    data class Endpoints(
        val authorize: String = "https://accounts.google.com/o/oauth2/v2/auth",
        val token: String = "https://oauth2.googleapis.com/token",
        val revoke: String = "https://oauth2.googleapis.com/revoke",
        val api: String = "https://www.googleapis.com/calendar/v3",
    )

    private val http =
        RestClient
            .builder()
            .requestFactory(
                JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(TIMEOUT).build()).apply {
                    setReadTimeout(TIMEOUT)
                },
            ).build()

    override fun authorizeUrl(state: String, challenge: String): String =
        UriComponentsBuilder
            .fromUriString(endpoints.authorize)
            .queryParam("client_id", clientId)
            .queryParam("redirect_uri", redirectUri)
            .queryParam("response_type", "code")
            .queryParam("scope", SCOPES.joinToString(" "))
            .queryParam("state", state)
            .queryParam("code_challenge", challenge)
            .queryParam("code_challenge_method", "S256")
            .queryParam("access_type", "offline")
            .queryParam("prompt", "consent")
            .queryParam("include_granted_scopes", "true")
            .encode()
            .build()
            .toUriString()

    override fun exchange(code: String, verifier: String): ProviderTokens =
        tokens(
            form(
                "grant_type" to "authorization_code",
                "code" to code,
                "code_verifier" to verifier,
                "redirect_uri" to redirectUri,
            ),
        )

    override fun refresh(refreshToken: String): ProviderTokens =
        tokens(form("grant_type" to "refresh_token", "refresh_token" to refreshToken))

    override fun revoke(token: String) {
        send(URI.create(endpoints.revoke), null) {
            http
                .post()
                .uri(it)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(LinkedMultiValueMap<String, String>().apply { add("token", token) })
        }
    }

    override fun calendars(accessToken: String): List<ProviderCalendar> =
        pages(accessToken, listOf("users", "me", "calendarList"), mapOf("minAccessRole" to "reader"))
            .flatMap { it.path("items").values() }
            .map { item ->
                ProviderCalendar(
                    id = item.path("id").asString(),
                    name = item.path("summaryOverride").asString(item.path("summary").asString("Calendar")),
                    color = item.path("backgroundColor").asString(DEFAULT_COLOR),
                    primary = item.path("primary").asBoolean(false),
                )
            }

    override fun events(accessToken: String, calendarId: String, window: EventWindow, syncToken: String?): EventPage {
        val query =
            if (syncToken == null) {
                mapOf("timeMin" to window.from.toString(), "timeMax" to window.to.toString())
            } else {
                mapOf("syncToken" to syncToken, "showDeleted" to "true")
            }
        val pages =
            pages(
                accessToken,
                listOf("calendars", calendarId, "events"),
                query + mapOf("singleEvents" to "true", "maxResults" to "2500"),
            )
        return EventPage(
            events = pages.flatMap { it.path("items").values() }.map(::event),
            syncToken = pages.last().path("nextSyncToken").asString(null),
            full = syncToken == null,
        )
    }

    private fun event(item: JsonNode): ProviderEvent {
        val allDay = item.path("start").has("date")
        return ProviderEvent(
            id = item.path("id").asString(),
            status = item.path("status").asString("confirmed"),
            title = item.path("summary").asString("").ifBlank { "(No title)" },
            start = moment(item.path("start")),
            end = moment(item.path("end")),
            allDay = allDay,
            location = item.path("location").asString(null)?.ifBlank { null },
            link = item.path("htmlLink").asString(null),
            updated = item.path("updated").asString(null)?.let { Instant.parse(it).epochSecond } ?: 0,
        )
    }

    private fun moment(node: JsonNode): Long =
        when {
            node.has("dateTime") -> OffsetDateTime.parse(node.path("dateTime").asString()).toEpochSecond()

            node.has(
                "date",
            ) -> LocalDate.parse(node.path("date").asString()).atStartOfDay(ZoneOffset.UTC).toEpochSecond()

            else -> 0
        }

    private fun pages(accessToken: String, path: List<String>, query: Map<String, String>): List<JsonNode> {
        val pages = mutableListOf<JsonNode>()
        var next: String? = null
        do {
            val uri =
                UriComponentsBuilder
                    .fromUriString(endpoints.api)
                    .pathSegment(*path.toTypedArray())
                    .apply {
                        query.forEach { (name, value) -> queryParam(name, value) }
                        next?.let { queryParam("pageToken", it) }
                    }.encode()
                    .build()
                    .toUri()
            val page = send(uri, accessToken) { http.get().uri(it) }
            pages.add(page)
            next = page.path("nextPageToken").asString(null)
        } while (next != null && pages.size < MAX_PAGES)
        return pages
    }

    private fun tokens(body: LinkedMultiValueMap<String, String>): ProviderTokens {
        val reply =
            send(URI.create(endpoints.token), null) {
                http
                    .post()
                    .uri(it)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body)
            }
        val identity = reply.path("id_token").asString(null)?.let(::claims)
        return ProviderTokens(
            accessToken = reply.path("access_token").asString(),
            refreshToken = reply.path("refresh_token").asString(null),
            expiresAt = clock.now().epochSecond + reply.path("expires_in").asLong(3600),
            subject = identity?.path("sub")?.asString(null),
            email = identity?.path("email")?.asString(null),
        )
    }

    private fun claims(idToken: String): JsonNode? =
        idToken
            .split('.')
            .getOrNull(1)
            ?.let { runCatching { mapper.readTree(Base64.getUrlDecoder().decode(it)) }.getOrNull() }

    private fun form(vararg fields: Pair<String, String>) =
        LinkedMultiValueMap<String, String>().apply {
            add("client_id", clientId)
            add("client_secret", clientSecret)
            fields.forEach { (name, value) -> add(name, value) }
        }

    private fun send(
        uri: URI,
        accessToken: String?,
        request: (URI) -> RestClient.RequestHeadersSpec<*>,
    ): JsonNode {
        val (status, body) =
            try {
                request(uri)
                    .headers { headers -> accessToken?.let { headers.setBearerAuth(it) } }
                    .exchange { _, response ->
                        response.statusCode to response.body.readAllBytes().toString(StandardCharsets.UTF_8)
                    }
            } catch (error: IOException) {
                throw ProviderException(Reason.RETRY, "Google Calendar couldn't be reached", error)
            } catch (error: ResourceAccessException) {
                throw ProviderException(Reason.RETRY, "Google Calendar couldn't be reached", error)
            }
        if (status.is2xxSuccessful) return if (body.isBlank()) mapper.createObjectNode() else mapper.readTree(body)
        throw ProviderException(reason(status, body), "Google Calendar answered ${status.value()}")
    }

    private fun reason(status: HttpStatusCode, body: String): Reason =
        when {
            body.contains("invalid_grant") -> Reason.REVOKED
            status.value() == 401 -> Reason.REVOKED
            status.value() == 410 -> Reason.RESYNC
            status.value() == 403 && body.contains("ateLimitExceeded") -> Reason.RETRY
            status.value() == 403 -> Reason.REVOKED
            status.value() == 429 || status.is5xxServerError -> Reason.RETRY
            else -> Reason.FAILED
        }

    companion object {
        val SCOPES =
            listOf(
                "openid",
                "email",
                "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
                "https://www.googleapis.com/auth/calendar.events.readonly",
            )
        const val DEFAULT_COLOR = "#039be5"
        private const val MAX_PAGES = 40
        private val TIMEOUT: Duration = Duration.ofSeconds(15)
    }
}
