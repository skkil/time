package com.skkil.time.features.notifications.service

import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.notifications.domain.NotificationPrefs
import com.skkil.time.features.notifications.domain.Reminder
import com.skkil.time.features.notifications.domain.ReminderKind
import com.skkil.time.features.settings.repository.SettingsRepository
import com.skkil.time.features.workflow.service.TaskWorkflowService
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/** What to remind about between two moments, by the same rules as time-core's `reminders::upcoming`. */
@Service
@Transactional(readOnly = true)
class ReminderService(
    private val jdbc: JdbcClient,
    private val settings: SettingsRepository,
    private val workflow: TaskWorkflowService,
) {
    fun upcoming(caller: Caller, from: Long, to: Long, prefs: NotificationPrefs): List<Reminder> {
        if (!prefs.on || settings.read(caller.id, ENABLED) == "off" || to <= from) return emptyList()
        val within = { at: Long -> at in (from + 1)..to }
        val found = mutableListOf<Reminder>()
        if (prefs.tasks) {
            jdbc
                .sql(
                    """
                    SELECT t.id, t.title, t.due_date, t.due_time FROM task t
                    LEFT JOIN item_type ty ON ty.id = t.type_id
                    LEFT JOIN project p ON p.id = t.project_id
                    WHERE t.user_id = :user AND t.due_date BETWEEN :first AND :last AND t.due_time IS NOT NULL
                      AND t.completed_at IS NULL
                      AND COALESCE(ty.kind, 'task') = 'task' AND (p.id IS NULL OR NOT p.archived)
                    """,
                ).param("user", caller.id)
                .param("first", caller.dateOf(from).minusDays(1))
                .param("last", caller.dateOf(to).plusDays(1))
                .query { rs, _ ->
                    val day = rs.getObject("due_date", LocalDate::class.java)
                    val minute = rs.getInt("due_time")
                    val at = caller.at(day, minute)
                    val id = rs.uuid("id")
                    Reminder("task:$id:$day $minute", ReminderKind.TASK, at, rs.getString("title"), at, id, null, "")
                }.list()
                .filterTo(found) { within(it.at) }
        }
        if (prefs.blocks) {
            jdbc
                .sql(
                    """
                    SELECT b.id, b.task_id, t.title, b.start_at FROM time_block b
                    JOIN task t ON t.id = b.task_id
                    WHERE b.user_id = :user AND b.start_at > :from AND b.start_at <= :to
                      AND t.completed_at IS NULL
                    """,
                ).param("user", caller.id)
                .param("from", from)
                .param("to", to)
                .query { rs, _ ->
                    val id = rs.uuid("id")
                    val at = rs.getLong("start_at")
                    Reminder(
                        "block:$id:$at",
                        ReminderKind.BLOCK,
                        at,
                        rs.getString("title"),
                        at,
                        rs.uuid("task_id"),
                        id,
                        "",
                    )
                }.list()
                .let(found::addAll)
        }
        if (prefs.events) {
            val lead = EVENT_LEAD_MINUTES * 60
            workflow
                .occurrences(caller, caller.dateOf(from + lead).minusDays(1), caller.dateOf(to + lead).plusDays(2))
                .map { event ->
                    Reminder(
                        "event:${event.taskId}:${event.startAt}",
                        ReminderKind.EVENT,
                        event.startAt - lead,
                        event.title,
                        event.startAt,
                        event.taskId,
                        null,
                        event.location,
                    )
                }.filterTo(found) { within(it.at) }
        }
        return found.sortedWith(compareBy({ it.at }, { it.key }))
    }

    companion object {
        const val ENABLED = "reminders_enabled"
        const val EVENT_LEAD_MINUTES = 10L
    }
}
