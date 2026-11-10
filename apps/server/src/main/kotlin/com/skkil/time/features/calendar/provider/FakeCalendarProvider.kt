package com.skkil.time.features.calendar.provider

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.features.calendar.provider.ProviderException.Reason
import org.springframework.web.util.UriComponentsBuilder
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * A calendar service in memory, for `skkil dev` and tests: consenting goes straight back to the callback, and two
 * calendars hold a few weeks of meetings around today in [zone]. Tests change events, revoke access or fail the next
 * call; every change bumps a version that serves as the sync token.
 */
class FakeCalendarProvider(
    private val redirectUri: String,
    private val clock: MutationClock,
    private val zone: ZoneId = ZoneId.systemDefault(),
) : CalendarProvider {
    private data class Stored(val calendar: String, val event: ProviderEvent, val version: Long)

    private val calendars =
        listOf(
            ProviderCalendar(PRIMARY, "Work", "#039be5", true),
            ProviderCalendar(FAMILY, "Family", "#33b679", false),
        )
    private val stored = mutableMapOf<Pair<String, String>, Stored>()
    private var version = 0L
    private var issued = 0
    private var revokedAccess = false
    private var resync = false
    private var failure: Reason? = null
    private val revokedTokens = mutableListOf<String>()

    init {
        reset()
    }

    val revoked: List<String> @Synchronized get() = revokedTokens.toList()

    @Synchronized
    fun reset() {
        stored.clear()
        version = 0
        revokedAccess = false
        resync = false
        failure = null
        revokedTokens.clear()
        fixtures().forEach { (calendar, event) -> put(calendar, event) }
    }

    @Synchronized
    fun clear() {
        stored.clear()
        version++
    }

    @Synchronized
    fun put(calendar: String, event: ProviderEvent) {
        version++
        stored[calendar to event.id] = Stored(calendar, event, version)
    }

    @Synchronized
    fun cancel(calendar: String, id: String) {
        val current = checkNotNull(stored[calendar to id]) { "No event $id" }
        put(calendar, current.event.copy(status = ProviderEvent.CANCELLED))
    }

    @Synchronized
    fun events(calendar: String): List<ProviderEvent> =
        stored.values.filter { it.calendar == calendar && !it.event.cancelled }.map { it.event }

    @Synchronized
    fun revokeAccess() {
        revokedAccess = true
    }

    @Synchronized
    fun expireSyncTokens() {
        resync = true
    }

    @Synchronized
    fun failNext(reason: Reason) {
        failure = reason
    }

    override fun authorizeUrl(state: String, challenge: String): String =
        UriComponentsBuilder
            .fromUriString(redirectUri)
            .queryParam("code", "fake-$challenge")
            .queryParam("state", state)
            .encode()
            .build()
            .toUriString()

    @Synchronized
    override fun exchange(code: String, verifier: String): ProviderTokens {
        check(code.startsWith("fake-")) { "Not a fake code" }
        revokedAccess = false
        return tokens("fake-refresh-${++issued}").copy(subject = SUBJECT, email = EMAIL)
    }

    @Synchronized
    override fun refresh(refreshToken: String): ProviderTokens {
        fail()
        if (revokedAccess) throw ProviderException(Reason.REVOKED, "invalid_grant")
        return tokens(null)
    }

    @Synchronized
    override fun revoke(token: String) {
        revokedTokens += token
    }

    @Synchronized
    override fun calendars(accessToken: String): List<ProviderCalendar> {
        fail()
        return calendars
    }

    @Synchronized
    override fun events(accessToken: String, calendarId: String, window: EventWindow, syncToken: String?): EventPage {
        fail()
        if (syncToken != null && resync) {
            resync = false
            throw ProviderException(Reason.RESYNC, "Sync token expired")
        }
        val mine = stored.values.filter { it.calendar == calendarId }
        val events =
            if (syncToken == null) {
                mine.filter { !it.event.cancelled && window.overlaps(it.event) }
            } else {
                mine.filter { it.version > syncToken.toLong() }
            }
        return EventPage(events.map { it.event }, version.toString(), syncToken == null)
    }

    private fun fail() {
        if (revokedAccess) throw ProviderException(Reason.REVOKED, "invalid_grant")
        failure?.let {
            failure = null
            throw ProviderException(it, "Failing as asked")
        }
    }

    private fun tokens(refresh: String?) =
        ProviderTokens("fake-access-${++issued}", refresh, clock.now().epochSecond + 3600)

    private fun fixtures(): List<Pair<String, ProviderEvent>> {
        val today = LocalDate.ofInstant(clock.now(), zone)
        val monday = today.with(DayOfWeek.MONDAY)
        val events = mutableListOf<Pair<String, ProviderEvent>>()
        for (offset in -14L..42L) {
            val day = monday.plusDays(offset)
            val weekday = day.dayOfWeek
            if (weekday == DayOfWeek.SATURDAY || weekday == DayOfWeek.SUNDAY) {
                if (weekday ==
                    DayOfWeek.SATURDAY
                ) {
                    events +=
                        FAMILY to timed("brunch", day, "Brunch with Sam", 10, 30, 90, "Cafe Onion")
                }
                continue
            }
            events += PRIMARY to timed("standup", day, "Standup", 9, 30, 15, null)
            if (weekday == DayOfWeek.TUESDAY || weekday == DayOfWeek.THURSDAY) {
                events += PRIMARY to timed("design", day, "Design review", 14, 0, 60, "Room 4")
            }
            if (weekday ==
                DayOfWeek.WEDNESDAY
            ) {
                events += PRIMARY to timed("one-on-one", day, "1:1 with Mina", 11, 0, 30, null)
            }
            if (weekday == DayOfWeek.FRIDAY) events += FAMILY to timed("pickup", day, "School pickup", 15, 30, 30, null)
        }
        val offsite = monday.plusDays(10)
        events +=
            PRIMARY to
            ProviderEvent(
                id = "offsite",
                status = "confirmed",
                title = "Team offsite",
                start = offsite.atStartOfDay(ZoneOffset.UTC).toEpochSecond(),
                end = offsite.plusDays(1).atStartOfDay(ZoneOffset.UTC).toEpochSecond(),
                allDay = true,
                location = null,
                link = "https://calendar.google.com/calendar/event?eid=offsite",
                updated = clock.now().epochSecond,
            )
        return events
    }

    private fun timed(
        kind: String,
        day: LocalDate,
        title: String,
        hour: Int,
        minute: Int,
        minutes: Long,
        location: String?,
    ): ProviderEvent {
        val start = day.atTime(LocalTime.of(hour, minute)).atZone(zone)
        val id = "${kind}_$day"
        return ProviderEvent(
            id = id,
            status = "confirmed",
            title = title,
            start = start.toEpochSecond(),
            end = start.plusMinutes(minutes).toEpochSecond(),
            allDay = false,
            location = location,
            link = "https://calendar.google.com/calendar/event?eid=$id",
            updated = clock.now().epochSecond,
        )
    }

    companion object {
        const val PRIMARY = "you@example.com"
        const val FAMILY = "family@group.calendar.google.com"
        const val SUBJECT = "fake-google-user"
        const val EMAIL = "you@example.com"
    }
}
