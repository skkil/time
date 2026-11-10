package com.skkil.time.features.calendar.job

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.config.AppProperties
import com.skkil.time.features.calendar.repository.CalendarRepository
import com.skkil.time.features.calendar.service.CalendarConnector
import com.skkil.time.features.calendar.service.CalendarSync
import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant

/** Advisory lock that lets one server instance claim calendar accounts at a time. */
internal const val CALENDAR_LOCK_KEY = 0x736B6B696C_0002L

/**
 * Keeps connected calendars fresh. Every [TICK] one instance, holding [CALENDAR_LOCK_KEY], claims the accounts that
 * are due by moving their next sync [LEASE] ahead, so no other instance takes them; each is then synced on its own,
 * and the sync sets the time of the next one. It runs on a virtual thread from when the server is ready, while
 * `time.calendar.sync` is on and a provider is configured.
 */
@Component
class CalendarSyncJob(
    private val jdbc: JdbcClient,
    private val repository: CalendarRepository,
    private val sync: CalendarSync,
    private val connector: CalendarConnector,
    private val clock: MutationClock,
    private val properties: AppProperties,
    transactions: PlatformTransactionManager,
) {
    private val transaction = TransactionTemplate(transactions)

    @EventListener(ApplicationReadyEvent::class)
    fun start() {
        if (properties.calendar.sync && connector.available) Thread.ofVirtual().name("calendar-sync").start(::loop)
    }

    /** Syncs the accounts due at [now]; returns how many it synced, or null when another instance is claiming. */
    fun run(now: Instant): Int? {
        val claimed =
            transaction.execute {
                val locked =
                    jdbc
                        .sql("SELECT pg_try_advisory_xact_lock(:key)")
                        .param("key", CALENDAR_LOCK_KEY)
                        .query(Boolean::class.java)
                        .single()
                if (locked) repository.claimDue(now.epochSecond, now.plus(LEASE).epochSecond, MAX_PER_RUN) else null
            } ?: return null
        return claimed.count { (user, id) ->
            runCatching { sync.sync(user, id, now) == CalendarSync.Outcome.SYNCED }
                .onFailure { log.error("Calendar sync of account {} failed", id, it) }
                .getOrDefault(false)
        }
    }

    private fun loop() {
        while (true) {
            runCatching { run(clock.now()) }.onFailure { log.error("Calendar sync run failed", it) }
            Thread.sleep(TICK)
        }
    }

    private companion object {
        val TICK: Duration = Duration.ofMinutes(1)
        val LEASE: Duration = Duration.ofMinutes(10)
        const val MAX_PER_RUN = 50
        val log = LoggerFactory.getLogger(CalendarSyncJob::class.java)
    }
}
