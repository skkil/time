package com.skkil.time.features.calendar

import com.skkil.time.common.id.NaturalIds
import com.skkil.time.features.calendar.api.CalendarCallbackController
import com.skkil.time.features.calendar.api.SourceVisible
import com.skkil.time.features.calendar.job.CALENDAR_LOCK_KEY
import com.skkil.time.features.calendar.job.CalendarSyncJob
import com.skkil.time.features.calendar.provider.FakeCalendarProvider
import com.skkil.time.features.calendar.provider.FakeCalendarProvider.Companion.FAMILY
import com.skkil.time.features.calendar.provider.FakeCalendarProvider.Companion.PRIMARY
import com.skkil.time.features.calendar.provider.ProviderEvent
import com.skkil.time.features.calendar.provider.ProviderException.Reason
import com.skkil.time.features.calendar.service.CalendarConnector
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.get
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.databind.JsonNode
import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CalendarTest : ApiTest() {
    @Autowired lateinit var connector: CalendarConnector

    @Autowired lateinit var job: CalendarSyncJob

    @Autowired lateinit var dataSource: DataSource

    private val fake get() = connector.provider as FakeCalendarProvider

    private val monday: LocalDate get() = LocalDate.now(ZoneId.systemDefault()).with(DayOfWeek.MONDAY)

    @BeforeEach
    fun quietOtherAccounts() {
        fake.reset()
        jdbc.sql("UPDATE calendar_account SET status = 'reauth'").update()
    }

    private fun callback(state: String?, code: String?) =
        mvc.get(CalendarCallbackController.CALLBACK) {
            state?.let { param("state", it) }
            code?.let { param("code", it) }
        }

    private fun connect(): UUID {
        val url = postJson("/api/v1/calendar/google/connect")["url"].asString()
        val query = UriComponentsBuilder.fromUriString(url).build().queryParams
        callback(query.getFirst("state"), query.getFirst("code")).andExpect { status { isOk() } }
        return status()["accounts"].values().single().id()
    }

    private fun status(): JsonNode = getJson("/api/v1/calendar")

    private fun sources(): List<JsonNode> = getJson("/api/v1/calendar/sources").values().toList()

    private fun events(from: LocalDate = monday, to: LocalDate = monday.plusDays(7)): List<JsonNode> =
        getJson("/api/v1/calendar/events?from=$from&to=$to").values().toList()

    private fun titles(from: LocalDate = monday, to: LocalDate = monday.plusDays(7)) =
        events(from, to).map { it["title"].asString() }

    private fun account(id: UUID): Map<String, Any?> =
        jdbc
            .sql("SELECT status, failures, next_sync_at, refresh_token_enc FROM calendar_account WHERE id = :id")
            .param("id", id)
            .query { rs, _ ->
                mapOf(
                    "status" to rs.getString(1),
                    "failures" to rs.getInt(2),
                    "next" to rs.getLong(3),
                    "refresh" to rs.getString(4),
                )
            }.single()

    private fun later(minutes: Long = 6) = Instant.now().plus(Duration.ofMinutes(minutes))

    private fun logged(table: String): List<String> =
        jdbc
            .sql("SELECT data::text FROM store_log WHERE scope_id = :scope AND table_name = :table AND op <> 'delete'")
            .param("scope", scopeId())
            .param("table", table)
            .query(String::class.java)
            .list()
            .filterNotNull()

    private fun timed(id: String, title: String, day: LocalDate, hour: Int) =
        day.atTime(hour, 0).atZone(ZoneId.systemDefault()).toEpochSecond().let {
            ProviderEvent(id, "confirmed", title, it, it + 3600, false, null, null, 0)
        }

    @Test
    fun `this server offers calendars and no account is connected at first`() {
        val status = status()
        assertTrue(status["available"].asBoolean())
        assertTrue(status["accounts"].isEmpty)
        assertTrue(sources().isEmpty())
    }

    @Test
    fun `connecting stores the tokens sealed and the first sync brings calendars and events to every device`() {
        val id = connect()
        val account = status()["accounts"].single()
        assertEquals("you@example.com", account["email"].asString())
        assertEquals("active", account["status"].asString())
        assertTrue(!(account(id)["refresh"] as String).contains("fake-refresh"))

        val calendars = sources()
        assertEquals(listOf("Work", "Family"), calendars.map { it["name"].asString() })
        assertEquals(NaturalIds.calendarSource(scopeId(), id, PRIMARY), calendars[0].id())
        assertTrue(calendars.all { it["visible"].asBoolean() })

        val week = events()
        assertTrue("Standup" in week.map { it["title"].asString() })
        val standup = week.first { it["title"].asString() == "Standup" }
        val external = "standup_${LocalDate.ofInstant(
            Instant.ofEpochSecond(standup["startAt"].asLong()),
            ZoneId.systemDefault(),
        )}"
        assertEquals(NaturalIds.calendarEvent(scopeId(), calendars[0].id(), external), standup.id())
        assertEquals("https://calendar.google.com/calendar/event?eid=$external", standup["link"].asString())

        val offsite = events(monday.plusDays(10), monday.plusDays(11)).single { it["allDay"].asBoolean() }
        assertEquals(monday.plusDays(10).toString(), offsite["startDate"].asString())
        assertEquals(monday.plusDays(11).toString(), offsite["endDate"].asString())
        assertEquals(monday.plusDays(10).atStartOfDay(ZoneOffset.UTC).toEpochSecond(), offsite["startAt"].asLong())

        val images = logged("calendar_event")
        assertTrue(images.isNotEmpty())
        assertTrue(images.none { "user_id" in it })
        assertTrue(logged("calendar_source").none { "sync_token" in it })
    }

    @Test
    fun `an incremental sync updates, adds and cancels events`() {
        val id = connect()
        val tuesday = monday.plusDays(1)
        fake.put(PRIMARY, fake.events(PRIMARY).first { it.id == "standup_$tuesday" }.copy(title = "Standup, moved"))
        fake.cancel(PRIMARY, "design_$tuesday")
        fake.put(FAMILY, timed("dentist", "Dentist", tuesday, 17))

        assertEquals(1, job.run(later()))

        val tuesdays = titles(tuesday, tuesday.plusDays(1))
        assertTrue("Standup, moved" in tuesdays && "Dentist" in tuesdays)
        assertTrue("Design review" !in tuesdays && "Standup" !in tuesdays)
        assertEquals("active", account(id)["status"])

        fake.expireSyncTokens()
        fake.put(PRIMARY, timed("retro", "Retro", tuesday, 16))
        assertEquals(1, job.run(later(12)))
        assertTrue("Retro" in titles(tuesday, tuesday.plusDays(1)))
    }

    @Test
    fun `a full read drops events the calendar no longer has, and the window bounds what is kept`() {
        connect()
        fake.clear()
        fake.put(PRIMARY, timed("far", "Far away", monday.plusDays(200), 9))
        fake.put(PRIMARY, timed("soon", "Soon", monday.plusDays(2), 9))
        asServer { jdbc.sql("UPDATE calendar_source SET full_synced_at = 0").update() }

        job.run(later())

        assertEquals(listOf("Soon"), titles(monday.minusDays(30), monday.plusDays(300)))
    }

    @Test
    fun `hiding a calendar hides its events`() {
        connect()
        val family = sources().first { it["name"].asString() == "Family" }.id()
        val hidden = putJson("/api/v1/calendar/sources/$family/visible", SourceVisible(false))
        assertTrue(!hidden["visible"].asBoolean())
        val all = titles(monday.minusDays(7), monday.plusDays(14))
        assertTrue("School pickup" !in all && "Standup" in all)

        job.run(later())
        assertTrue(!sources().first { it.id() == family }["visible"].asBoolean())
    }

    @Test
    fun `a revoked grant asks to connect again, and connecting again resumes the same account`() {
        val id = connect()
        fake.revokeAccess()
        jdbc.sql("UPDATE calendar_account SET expires_at = 0 WHERE id = :id").param("id", id).update()

        assertEquals(0, job.run(later()))
        assertEquals("reauth", status()["accounts"].single()["status"].asString())
        assertEquals(0, job.run(later(30)))
        assertTrue(titles().isNotEmpty())

        assertEquals(id, connect())
        assertEquals("active", status()["accounts"].single()["status"].asString())
    }

    @Test
    fun `failures back off`() {
        val id = connect()
        fake.failNext(Reason.RETRY)
        val now = later()

        assertEquals(0, job.run(now))

        val state = account(id)
        assertEquals(1, state["failures"])
        assertEquals(now.plus(Duration.ofMinutes(10)).epochSecond, state["next"])
        assertEquals(0, job.run(now.plus(Duration.ofMinutes(9))))
        assertEquals(1, job.run(now.plus(Duration.ofMinutes(11))))
        assertEquals(0, account(id)["failures"])
    }

    @Test
    fun `disconnecting revokes access and removes the account with its calendars and events`() {
        val id = connect()
        delete("/api/v1/calendar/accounts/$id").andExpect { status { isNoContent() } }

        assertTrue(status()["accounts"].isEmpty)
        assertTrue(sources().isEmpty())
        assertTrue(events(monday.minusDays(30), monday.plusDays(60)).isEmpty())
        assertTrue(fake.revoked.single().startsWith("fake-refresh-"))
        val gone =
            jdbc
                .sql(
                    "SELECT count(*) FROM store_log WHERE scope_id = :scope AND table_name = 'calendar_event' AND op = 'delete'",
                )
                .param("scope", scopeId())
                .query(Long::class.java)
                .single()
        assertTrue(gone > 0)
        delete("/api/v1/calendar/accounts/$id").andExpect { status { isNotFound() } }
    }

    @Test
    fun `nobody else sees, hides, syncs or removes an account`() {
        val id = connect()
        val source = sources().first().id()
        val owner = subject

        newUser()
        assertTrue(status()["accounts"].isEmpty)
        assertTrue(sources().isEmpty())
        assertTrue(events().isEmpty())
        expectProblem(put("/api/v1/calendar/sources/$source/visible", SourceVisible(false)), 404, "notFound")
        expectProblem(delete("/api/v1/calendar/accounts/$id"), 404, "notFound")

        subject = owner
        assertEquals(2, sources().size)
        assertTrue(sources().all { it["visible"].asBoolean() })
    }

    @Test
    fun `a stale, forged or refused consent connects nothing`() {
        postJson("/api/v1/calendar/google/connect")
        callback("forged", "fake-code").andExpect {
            status { isBadRequest() }
            content { string(org.hamcrest.Matchers.containsString("expired")) }
        }
        callback(null, null).andExpect { status { isBadRequest() } }
        assertTrue(status()["accounts"].isEmpty)
    }

    @Test
    fun `a second instance holding the lock syncs nothing`() {
        connect()
        dataSource.connection.use { other ->
            other.autoCommit = false
            other.prepareStatement("SELECT pg_advisory_xact_lock($CALENDAR_LOCK_KEY)").execute()
            assertNull(job.run(later()))
            other.rollback()
        }
        assertNotNull(job.run(later()))
    }
}
