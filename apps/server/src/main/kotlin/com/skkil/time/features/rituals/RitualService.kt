package com.skkil.time.features.rituals

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.web.Caller
import com.skkil.time.features.review.monday
import com.skkil.time.features.settings.repository.SettingsRepository
import com.skkil.time.features.tasks.service.TaskService
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/** Configurable routines and their runs; [due] decides which one opens for an app event. */
@Service
@Transactional
class RitualService(
    private val jdbc: JdbcClient,
    private val settings: SettingsRepository,
    private val tasks: TaskService,
) {
    @Transactional(readOnly = true)
    fun get(user: Long, kind: String): Ritual =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND kind = :kind")
            .param("user", user)
            .param("kind", kind)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Ritual")

    @Transactional(readOnly = true)
    fun list(user: Long): List<Ritual> = KINDS.map { get(user, it) }

    fun update(user: Long, kind: String, input: RitualInput): Ritual {
        val current = get(user, kind)
        ensure(input.trigger in TRIGGERS) { "Unknown trigger: ${input.trigger}" }
        ensure((kind == "session") == (input.trigger == "after_timer_stop") || input.trigger == "manual") {
            "Only the session ritual follows the timer."
        }
        ensure(input.atMinute in 0..<24 * 60) { "Time must be within the day." }
        ensure(input.weekdays in 1..127) { "Pick at least one day." }
        val steps =
            if (kind == "weekly") {
                current.steps
            } else {
                ensure(input.steps.isNotEmpty()) { "Keep at least one step." }
                input.steps.forEach { step -> ensure(step in STEPS) { "Unknown step: $step" } }
                ensure(input.steps.toSet().size == input.steps.size) { "Each step appears once." }
                input.steps
            }
        jdbc
            .sql(
                """
                UPDATE ritual SET enabled = :enabled, trigger = :trigger, at_minute = :atMinute,
                  weekdays = :weekdays, steps = :steps
                WHERE user_id = :user AND kind = :kind
                """,
            ).param("enabled", input.enabled)
            .param("trigger", input.trigger)
            .param("atMinute", input.atMinute)
            .param("weekdays", input.weekdays)
            .param("steps", steps.joinToString(","))
            .param("user", user)
            .param("kind", kind)
            .update()
        return get(user, kind)
    }

    @Transactional(readOnly = true)
    fun planningTime(user: Long): String? = settings.read(user, PLANNING_SETTING)

    fun setPlanningTime(user: Long, time: String): List<Ritual> {
        ensure(time == "morning" || time == "evening") { "Plan in the morning or the evening." }
        settings.write(user, PLANNING_SETTING, time)
        jdbc
            .sql("UPDATE ritual SET enabled = (kind = :time) WHERE user_id = :user AND kind IN ('morning', 'evening')")
            .param("time", time)
            .param("user", user)
            .update()
        return list(user)
    }

    @Transactional(readOnly = true)
    fun runs(user: Long, from: LocalDate, to: LocalDate): List<RitualRun> =
        jdbc
            .sql("$SELECT_RUN WHERE user_id = :user AND date >= :from AND date < :to ORDER BY id")
            .param("user", user)
            .param("from", from)
            .param("to", to)
            .query(runMapper)
            .list()

    @Transactional(readOnly = true)
    fun due(caller: Caller, at: Moment, event: RitualEvent): Ritual? =
        list(caller.id).firstOrNull { isDue(caller, it, at, event) }

    fun start(caller: Caller, kind: String, at: Moment, taskId: Long?): RitualRun {
        get(caller.id, kind)
        taskId?.let { tasks.get(caller.id, it) }
        val previous = if (kind == "session") null else latestRun(caller.id, kind, at.date)
        if (previous != null && previous.finishedAt == null) {
            jdbc
                .sql("UPDATE ritual_run SET skipped = FALSE WHERE user_id = :user AND id = :id")
                .param("user", caller.id)
                .param("id", previous.id)
                .update()
            return run(caller.id, previous.id)
        }
        val id =
            jdbc
                .sql(
                    """
                    INSERT INTO ritual_run (user_id, kind, date, task_id, started_at)
                    VALUES (:user, :kind, :date, CAST(:task AS BIGINT), :startedAt) RETURNING id
                    """,
                ).param("user", caller.id)
                .param("kind", kind)
                .param("date", at.date)
                .param("task", taskId)
                .param("startedAt", at.stamp)
                .query(Long::class.java)
                .single()
        return run(caller.id, id)
    }

    fun reachStep(user: Long, id: Long, step: Int): RitualRun =
        updateRun(user, id, "step = GREATEST(step, :value)", step.coerceAtLeast(0))

    fun finish(user: Long, id: Long, at: Long): RitualRun =
        updateRun(user, id, "finished_at = COALESCE(finished_at, :value)", at)

    fun skip(user: Long, id: Long): RitualRun {
        val rows =
            jdbc
                .sql("UPDATE ritual_run SET skipped = TRUE WHERE user_id = :user AND id = :id AND finished_at IS NULL")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Ritual run")
        return run(user, id)
    }

    fun snooze(user: Long, id: Long, at: Long): RitualRun {
        ensure(run(user, id).snoozedUntil == null) { "This ritual was already snoozed once." }
        return updateRun(user, id, "snoozed_until = :value", at + SNOOZE_SECONDS)
    }

    private fun isDue(caller: Caller, ritual: Ritual, at: Moment, event: RitualEvent): Boolean {
        if (!ritual.enabled || !onWeekday(ritual, at.date)) return false
        if (ritual.trigger == "after_timer_stop") {
            return event is RitualEvent.TimerStopped && event.minutes >= ritual.minMinutes
        }
        if (event is RitualEvent.TimerStopped) return false
        latestRun(caller.id, ritual.kind, at.date)?.let { previous ->
            val snoozeOver = previous.snoozedUntil?.let { it <= at.stamp } ?: false
            return previous.finishedAt == null && !previous.skipped && snoozeOver
        }
        if (ritual.kind == "weekly" && lastWeekReviewed(caller.id, at.date)) return false
        return when (ritual.trigger) {
            "first_open" -> {
                true
            }

            "at_time" -> {
                at.minute >= ritual.atMinute
            }

            "end_of_day" -> {
                at.minute >= ritual.atMinute ||
                    (
                        at.minute >= ritual.atMinute - END_OF_DAY_EARLIEST_BEFORE &&
                            lastBlockEnd(caller, at.date)?.let { it <= at.stamp } == true
                    )
            }

            else -> {
                false
            }
        }
    }

    private fun onWeekday(ritual: Ritual, date: LocalDate): Boolean =
        ritual.weekdays and (1 shl (date.dayOfWeek.value - 1)) != 0

    private fun lastBlockEnd(caller: Caller, date: LocalDate): Long? =
        jdbc
            .sql("SELECT MAX(end_at) FROM time_block WHERE user_id = :user AND start_at >= :from AND start_at < :to")
            .param("user", caller.id)
            .param("from", caller.startOf(date))
            .param("to", caller.startOf(date.plusDays(1)))
            .query(Long::class.java)
            .optional()
            .orElse(null)

    private fun lastWeekReviewed(user: Long, date: LocalDate): Boolean =
        jdbc
            .sql("SELECT reviewed_at IS NOT NULL FROM week WHERE user_id = :user AND start_date = :start")
            .param("user", user)
            .param("start", date.monday().minusWeeks(1))
            .query(Boolean::class.java)
            .optional()
            .orElse(false)

    private fun run(user: Long, id: Long): RitualRun =
        jdbc
            .sql("$SELECT_RUN WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(runMapper)
            .optional()
            .orElse(null)
            .orNotFound("Ritual run")

    private fun latestRun(user: Long, kind: String, date: LocalDate): RitualRun? =
        jdbc
            .sql("$SELECT_RUN WHERE user_id = :user AND kind = :kind AND date = :date ORDER BY id DESC LIMIT 1")
            .param("user", user)
            .param("kind", kind)
            .param("date", date)
            .query(runMapper)
            .optional()
            .orElse(null)

    private fun updateRun(user: Long, id: Long, assignment: String, value: Any): RitualRun {
        val rows =
            jdbc
                .sql("UPDATE ritual_run SET $assignment WHERE user_id = :user AND id = :id")
                .param("value", value)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Ritual run")
        return run(user, id)
    }

    private companion object {
        val KINDS = listOf("weekly", "morning", "evening", "wind_down", "session")
        val TRIGGERS = setOf("first_open", "at_time", "end_of_day", "after_timer_stop", "manual")
        val STEPS =
            setOf(
                "feel",
                "what_moved",
                "leftovers",
                "pick_musts",
                "timeblock",
                "one_line_note",
                "habit_check",
                "breathing_pause",
                "next_step_note",
                "did_it_move",
                "brain_dump",
                "device_away",
            )
        const val SNOOZE_SECONDS = 15 * 60L
        const val END_OF_DAY_EARLIEST_BEFORE = 120
        const val PLANNING_SETTING = "planning_time"
        const val SELECT = "SELECT kind, enabled, trigger, at_minute, weekdays, min_minutes, steps FROM ritual"
        const val SELECT_RUN =
            "SELECT id, kind, date, task_id, started_at, finished_at, skipped, step, snoozed_until FROM ritual_run"
        val mapper =
            RowMapper { rs, _ ->
                Ritual(
                    rs.getString("kind"),
                    rs.getBoolean("enabled"),
                    rs.getString("trigger"),
                    rs.getInt("at_minute"),
                    rs.getInt("weekdays"),
                    rs.getInt("min_minutes"),
                    rs.getString("steps").split(',').filter { it.isNotEmpty() },
                )
            }
        val runMapper =
            RowMapper { rs, _ ->
                RitualRun(
                    rs.getLong("id"),
                    rs.getString("kind"),
                    rs.getObject("date", LocalDate::class.java),
                    rs.longOrNull("task_id"),
                    rs.getLong("started_at"),
                    rs.longOrNull("finished_at"),
                    rs.getBoolean("skipped"),
                    rs.getInt("step"),
                    rs.longOrNull("snoozed_until"),
                )
            }
    }
}
