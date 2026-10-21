package com.skkil.time.features.notifications.job

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.persistence.uuid
import com.skkil.time.features.notifications.domain.Push
import com.skkil.time.features.notifications.domain.PushMessage
import com.skkil.time.features.notifications.push.PushSender
import com.skkil.time.features.notifications.service.DeviceService
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.TimeUnit

/** Advisory lock that lets one server instance send reminders at a time. */
internal const val REMINDER_LOCK_KEY = 0x736B6B696C_0001L

/**
 * The desktop reminder thread as a job: a timed, open task fires once per due date and time, within
 * [GRACE_MINUTES] of its due moment in the owner's zone, to every device the owner registered.
 */
@Component
class ReminderJob(
    private val jdbc: JdbcClient,
    private val devices: DeviceService,
    private val senders: List<PushSender>,
    private val clock: MutationClock,
    transactions: PlatformTransactionManager,
) {
    private val transaction = TransactionTemplate(transactions)

    @Scheduled(fixedDelay = 20, timeUnit = TimeUnit.SECONDS)
    fun tick() {
        runCatching { run(clock.now()) }.onFailure { log.error("Reminder run failed", it) }
    }

    /** Sends what is due at [now]; returns how many tasks fired, or null when another instance is sending. */
    fun run(now: Instant): Int? =
        transaction.execute {
            val locked =
                jdbc
                    .sql("SELECT pg_try_advisory_xact_lock(:key)")
                    .param("key", REMINDER_LOCK_KEY)
                    .query(Boolean::class.java)
                    .single()
            if (locked) fire(now) else null
        }

    private fun fire(now: Instant): Int {
        val due = zones().flatMap { due(it, now) }.take(MAX_PER_RUN)
        if (due.isEmpty()) return 0
        val targets = devices.targets(due.map { it.user }.toSet())
        val messages = due.flatMap { task -> targets[task.user].orEmpty().map { PushMessage(it, task.push) } }
        val gone =
            senders.flatMap { sender ->
                val mine = messages.filter { it.target.kind == sender.kind }
                if (mine.isEmpty()) emptySet() else sender.send(mine)
            }
        devices.forget(gone)
        due.forEach { task ->
            jdbc
                .sql("UPDATE task SET reminded_for = :key WHERE id = :id AND user_id = :user")
                .param("key", task.remindedFor)
                .param("id", task.id)
                .param("user", task.user)
                .update()
        }
        return due.size
    }

    private fun zones(): List<String> =
        jdbc
            .sql(
                """
                SELECT DISTINCT u.time_zone FROM app_user u
                WHERE EXISTS (SELECT 1 FROM push_device d WHERE d.user_id = u.id)
                """,
            ).query { rs, _ -> rs.getString("time_zone") }
            .list()

    private fun due(zoneName: String, now: Instant): List<DueTask> {
        val zone = runCatching { ZoneId.of(zoneName) }.getOrDefault(UTC)
        val to = LocalDateTime.ofInstant(now, zone).truncatedTo(ChronoUnit.MINUTES)
        val from = to.minusMinutes(GRACE_MINUTES)
        return jdbc
            .sql(
                """
                SELECT t.id, t.user_id, t.title, t.due_date, t.due_time
                FROM task t
                JOIN app_user u ON u.id = t.user_id
                LEFT JOIN item_type it ON it.id = t.type_id
                WHERE u.time_zone = :zone
                  AND t.due_date BETWEEN :fromDate AND :toDate
                  AND t.due_date + make_interval(mins => t.due_time) BETWEEN :from AND :to
                  AND t.completed_at IS NULL
                  AND NOT t.someday
                  AND COALESCE(it.kind, 'task') = 'task'
                  AND t.reminded_for IS DISTINCT FROM to_char(t.due_date, 'YYYY-MM-DD') || ' ' || t.due_time
                  AND EXISTS (SELECT 1 FROM push_device d WHERE d.user_id = t.user_id)
                  AND NOT EXISTS (
                    SELECT 1 FROM setting s
                    WHERE s.user_id = t.user_id AND s.key = 'reminders_enabled' AND s.value = 'off'
                  )
                ORDER BY t.due_date, t.due_time, t.id
                LIMIT :limit
                """,
            ).param("zone", zoneName)
            .param("fromDate", from.toLocalDate())
            .param("toDate", to.toLocalDate())
            .param("from", from)
            .param("to", to)
            .param("limit", MAX_PER_RUN)
            .query { rs, _ ->
                DueTask(
                    rs.uuid("id"),
                    rs.getLong("user_id"),
                    rs.getString("title"),
                    rs.getObject("due_date", LocalDate::class.java),
                    rs.getInt("due_time"),
                )
            }.list()
    }

    private data class DueTask(val id: UUID, val user: Long, val title: String, val date: LocalDate, val minute: Int) {
        val remindedFor = "$date $minute"
        val push = Push(title, "%02d:%02d".format(minute / 60, minute % 60), id)
    }

    private companion object {
        const val GRACE_MINUTES = 10L
        const val MAX_PER_RUN = 500
        val UTC: ZoneId = ZoneId.of("UTC")
        val log = LoggerFactory.getLogger(ReminderJob::class.java)
    }
}
