package com.skkil.time.features.calendar.service

import com.skkil.time.common.id.NaturalIds
import com.skkil.time.features.calendar.domain.ConnectedAccount
import com.skkil.time.features.calendar.domain.SyncedSource
import com.skkil.time.features.calendar.provider.EventPage
import com.skkil.time.features.calendar.provider.EventWindow
import com.skkil.time.features.calendar.provider.ProviderException
import com.skkil.time.features.calendar.provider.ProviderException.Reason
import com.skkil.time.features.calendar.repository.CalendarRepository
import com.skkil.time.features.sync.service.ServerWrites
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Reads one account's calendars and events into `calendar_source` and `calendar_event` as server writes in the
 * owner's scope, so every device pulls them. A calendar is read whole over [WINDOW_BEFORE]..[WINDOW_AFTER] the first
 * time and once a day (which also slides the window), and incrementally with its sync token in between. A lost grant
 * marks the account for reconnecting; other failures back off.
 */
@Service
class CalendarSync(
    private val connector: CalendarConnector,
    private val repository: CalendarRepository,
    private val writes: ServerWrites,
) {
    enum class Outcome { SYNCED, REAUTH, FAILED, GONE }

    fun sync(user: Long, id: UUID, now: Instant): Outcome {
        val account = repository.connected(user, id) ?: return Outcome.GONE
        return try {
            val access = accessToken(account, now)
            sources(account, access)
            val window = EventWindow(now.minus(WINDOW_BEFORE), now.plus(WINDOW_AFTER))
            repository.syncedSources(user, id).forEach { events(account, it, access, window, now) }
            repository.succeeded(user, id, now.epochSecond, now.plus(EVERY).epochSecond)
            Outcome.SYNCED
        } catch (error: ProviderException) {
            if (error.reason == Reason.REVOKED) {
                repository.needsReauth(user, id)
                Outcome.REAUTH
            } else {
                log.warn("Calendar sync of account {} failed: {}", id, error.message)
                val failures = account.failures + 1
                val wait = EVERY.multipliedBy(1L shl failures.coerceAtMost(MAX_DOUBLINGS)).coerceAtMost(MAX_WAIT)
                repository.failed(user, id, failures, now.plus(wait).epochSecond)
                Outcome.FAILED
            }
        }
    }

    private fun accessToken(account: ConnectedAccount, now: Instant): String {
        val cipher = connector.cipher
        val current = account.accessToken?.let(cipher::decrypt)
        if (current != null && account.expiresAt > now.epochSecond + MARGIN_SECONDS) return current
        val fresh = connector.provider.refresh(cipher.decrypt(account.refreshToken))
        repository.saveAccess(
            account.user,
            account.id,
            cipher.encrypt(fresh.accessToken),
            fresh.expiresAt,
            fresh.refreshToken?.let(cipher::encrypt),
        )
        return fresh.accessToken
    }

    private fun sources(account: ConnectedAccount, access: String) {
        val calendars = connector.provider.calendars(access).sortedByDescending { it.primary }
        writes.run(account.scope) {
            val kept =
                calendars.mapIndexed { position, calendar ->
                    val id = NaturalIds.calendarSource(account.scope, account.id, calendar.id)
                    repository.upsertSource(
                        id,
                        account.user,
                        account.id,
                        calendar.id,
                        calendar.name,
                        calendar.color,
                        position,
                    )
                    id
                }
            repository.dropSourcesExcept(account.user, account.id, kept)
        }
    }

    private fun events(
        account: ConnectedAccount,
        source: SyncedSource,
        access: String,
        window: EventWindow,
        now: Instant,
    ) {
        val stale = source.fullSyncedAt == null || source.fullSyncedAt < now.minus(FULL_EVERY).epochSecond
        val token = source.syncToken.takeUnless { stale }
        val page =
            try {
                connector.provider.events(access, source.externalId, window, token)
            } catch (error: ProviderException) {
                if (error.reason != Reason.RESYNC || token == null) throw error
                connector.provider.events(access, source.externalId, window, null)
            }
        writes.run(account.scope) { apply(account, source, page, window, now) }
    }

    private fun apply(
        account: ConnectedAccount,
        source: SyncedSource,
        page: EventPage,
        window: EventWindow,
        now: Instant,
    ) {
        val user = account.user
        val (kept, dropped) = page.events.partition { !it.cancelled && window.overlaps(it) }
        dropped.forEach { repository.deleteEvent(user, source.id, it.id) }
        kept.forEach {
            repository.upsertEvent(NaturalIds.calendarEvent(account.scope, source.id, it.id), user, source.id, it)
        }
        if (page.full) repository.deleteEventsExcept(user, source.id, kept.map { it.id })
        repository.saveCursor(user, source.id, page.syncToken, if (page.full) now.epochSecond else null)
    }

    companion object {
        val EVERY: Duration = Duration.ofMinutes(5)
        val WINDOW_BEFORE: Duration = Duration.ofDays(14)
        val WINDOW_AFTER: Duration = Duration.ofDays(60)
        private val FULL_EVERY = Duration.ofDays(1)
        private val MAX_WAIT = Duration.ofHours(6)
        private const val MAX_DOUBLINGS = 7
        private const val MARGIN_SECONDS = 60
        private val log = LoggerFactory.getLogger(CalendarSync::class.java)
    }
}
