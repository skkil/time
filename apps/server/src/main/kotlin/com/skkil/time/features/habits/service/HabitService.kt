package com.skkil.time.features.habits.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.persistence.date
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.habits.domain.DayStatus
import com.skkil.time.features.habits.domain.Habit
import com.skkil.time.features.habits.domain.HabitDay
import com.skkil.time.features.habits.domain.HabitInput
import com.skkil.time.features.habits.domain.HabitMeasurement
import com.skkil.time.features.habits.domain.ManualStatus
import com.skkil.time.features.habits.domain.SyncReport
import com.skkil.time.features.habits.domain.TrackerState
import com.skkil.time.features.habits.domain.Tracking
import com.skkil.time.features.projects.service.ProjectService
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import java.util.UUID

private val KINDS = setOf("build", "quit", "limit")
private val UNITS = setOf("times", "minutes")
private val TIMES_OF_DAY = setOf("anytime", "morning", "afternoon", "evening")
private const val SYNC_DAYS = 60L
private const val ALL_DAYS = 0b111_1111
private const val CONSISTENCY_DAYS = 14L
private const val MAX_SKIP_DAYS = 2

private const val SELECT = """
    SELECT id, name, kind, goal, unit, days, time_of_day, area, start_date,
           track_source, track_patterns, track_project_id, skip_days, anchor
    FROM habit
"""

private data class Log(val status: String?, val value: Double)

private data class Valid(
    val name: String,
    val goal: Double,
    val unit: String,
    val area: String,
    val anchor: String,
    val tracking: Tracking?,
)

/**
 * Habits and their daily logs. A day's status is derived from the log, the schedule and today, never stored; a status
 * set by hand always wins over a measured value.
 */
@Service
@Transactional
class HabitService(private val jdbc: JdbcClient, private val projects: ProjectService) {
    @Transactional(readOnly = true)
    fun get(caller: Caller, id: UUID): Habit = withStats(caller, find(caller.id, id).orNotFound("Habit"))

    @Transactional(readOnly = true)
    fun list(caller: Caller): List<Habit> = active(caller.id).map { withStats(caller, it) }

    fun create(caller: Caller, input: HabitInput, id: UUID? = null): Habit =
        get(caller, write(caller.id, id ?: caller.nextId(), input, creating = true))

    fun update(caller: Caller, id: UUID, input: HabitInput): Habit {
        val before = get(caller, id)
        write(caller.id, id, input, creating = false)
        if (before.tracking != get(caller, id).tracking) {
            jdbc
                .sql("DELETE FROM habit_log WHERE habit_id = :id AND source = 'auto' AND status IS NULL")
                .param("id", id)
                .update()
        }
        return get(caller, id)
    }

    fun archive(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("UPDATE habit SET archived = TRUE WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Habit")
    }

    @Transactional(readOnly = true)
    fun days(caller: Caller, from: LocalDate, to: LocalDate): List<HabitDay> {
        val today = caller.today()
        val logs =
            jdbc
                .sql(
                    """
                    SELECT l.habit_id, l.date, l.status, l.value, l.source FROM habit_log l
                    JOIN habit h ON h.id = l.habit_id
                    WHERE h.user_id = :user AND l.date >= :from AND l.date < :to
                    """,
                ).param("user", caller.id)
                .param("from", from)
                .param("to", to)
                .query { rs, _ ->
                    (rs.uuid("habit_id") to rs.date("date")) to (log(rs) to (rs.getString("source") == "manual"))
                }.list()
                .toMap()
        return active(caller.id).flatMap { habit ->
            datesBetween(from, to).map { date ->
                val entry = logs[habit.id to date]
                val log = entry?.first
                HabitDay(
                    habit.id,
                    date,
                    status(habit, date, today, log),
                    log?.value ?: 0.0,
                    entry != null && (entry.second || log?.status != null),
                )
            }
        }
    }

    fun setStatus(caller: Caller, habitId: UUID, date: LocalDate, status: ManualStatus?) {
        ensureLoggable(caller, date)
        get(caller, habitId)
        jdbc
            .sql(
                """
                INSERT INTO habit_log (id, habit_id, date, status) VALUES (:id, :habit, :date, CAST(:status AS TEXT))
                ON CONFLICT (habit_id, date) DO UPDATE SET status = excluded.status
                """,
            ).param("id", NaturalIds.habitLog(caller.scopeId, habitId, date))
            .param("habit", habitId)
            .param("date", date)
            .param("status", status?.value)
            .update()
    }

    fun addValue(caller: Caller, habitId: UUID, date: LocalDate, delta: Double?) {
        ensureLoggable(caller, date)
        val habit = get(caller, habitId)
        ensure(habit.tracking == null) { "This habit is tracked automatically." }
        ensure(delta != null && delta.isFinite()) { "That value is out of range." }
        jdbc
            .sql(
                """
                INSERT INTO habit_log (id, habit_id, date, value) VALUES (:id, :habit, :date, GREATEST(0, :delta))
                ON CONFLICT (habit_id, date) DO UPDATE SET value = GREATEST(0, habit_log.value + :delta)
                """,
            ).param("id", NaturalIds.habitLog(caller.scopeId, habitId, date))
            .param("habit", habitId)
            .param("date", date)
            .param("delta", delta)
            .update()
    }

    /**
     * Measures project-tracked habits from tracked time. Website and app tracking reads ActivityWatch on the user's
     * machine, which the server can't reach, so those habits report it as unreachable.
     */
    fun sync(caller: Caller): SyncReport {
        val tracked = active(caller.id).filter { it.tracking != null }
        val today = caller.today()
        tracked.forEach { habit ->
            val projectId = habit.tracking?.projectId ?: return@forEach
            syncWindow(habit, today).forEach { day ->
                recordAuto(caller, habit.id, day, projectMinutes(caller, projectId, day))
            }
        }
        val watched = tracked.any { it.tracking?.source != "project" }
        return SyncReport(if (watched) TrackerState.UNREACHABLE else TrackerState.NOT_NEEDED, false, false, null)
    }

    /**
     * Writes values a device measured for its website and app habits (from ActivityWatch) as `auto` logs. A status set
     * by hand still wins, as with [sync].
     */
    fun recordMeasurements(caller: Caller, measurements: List<HabitMeasurement>) {
        for ((habitId, date, value) in measurements) {
            ensureLoggable(caller, date)
            ensure(value.isFinite() && value >= 0) { "A measured value can't be negative." }
            ensure(find(caller.id, habitId).orNotFound("Habit").tracking != null) {
                "Only tracked habits take measurements."
            }
            recordAuto(caller, habitId, date, value)
        }
    }

    private fun find(user: Long, id: UUID): Habit? =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query { rs, _ -> habit(rs) }
            .optional()
            .orElse(null)

    private fun active(user: Long): List<Habit> =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND NOT archived ORDER BY position, id")
            .param("user", user)
            .query { rs, _ -> habit(rs) }
            .list()

    private fun habit(rs: ResultSet): Habit {
        val source = rs.getString("track_source")
        return Habit(
            id = rs.uuid("id"),
            name = rs.getString("name"),
            kind = rs.getString("kind"),
            goal = rs.getDouble("goal"),
            unit = rs.getString("unit"),
            days = rs.getInt("days"),
            timeOfDay = rs.getString("time_of_day"),
            area = rs.getString("area"),
            startDate = rs.date("start_date"),
            tracking =
                source?.let {
                    Tracking(
                        it,
                        rs.getString("track_patterns").split('\n').filter(String::isNotEmpty),
                        rs.uuidOrNull("track_project_id"),
                    )
                },
            skipDays = rs.getInt("skip_days"),
            anchor = rs.getString("anchor"),
            doneDays = 0,
            dueDays = 0,
            cleanSince = null,
        )
    }

    private fun log(rs: ResultSet) = Log(rs.getString("status"), rs.getDouble("value"))

    private fun logsFor(habitId: UUID): Map<LocalDate, Log> =
        jdbc
            .sql("SELECT date, status, value FROM habit_log WHERE habit_id = :habit")
            .param("habit", habitId)
            .query { rs, _ -> rs.date("date") to log(rs) }
            .list()
            .toMap()

    private fun withStats(caller: Caller, habit: Habit): Habit {
        val today = caller.today()
        val logs = logsFor(habit.id)
        val forgiven = mutableMapOf<LocalDate, Int>()
        var doneDays = 0
        var dueDays = 0
        var date = maxOf(today.plusDays(1 - CONSISTENCY_DAYS), habit.startDate)
        while (date <= today) {
            when (status(habit, date, today, logs[date])) {
                DayStatus.DONE -> {
                    doneDays++
                    dueDays++
                }

                DayStatus.FAILED -> {
                    dueDays++
                }

                DayStatus.MISSED -> {
                    val week = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                    val used = forgiven.getOrDefault(week, 0)
                    if (used < habit.skipDays) forgiven[week] = used + 1 else dueDays++
                }

                else -> {}
            }
            date = date.plusDays(1)
        }
        val cleanSince =
            if (habit.kind == "build") {
                null
            } else {
                generateSequence(today) { it.minusDays(1) }
                    .takeWhile { it >= habit.startDate }
                    .firstOrNull { status(habit, it, today, logs[it]) == DayStatus.FAILED }
                    ?.plusDays(1) ?: habit.startDate
            }
        return habit.copy(doneDays = doneDays, dueDays = dueDays, cleanSince = cleanSince)
    }

    private fun validate(user: Long, input: HabitInput): Valid {
        val name = requiredText(input.name, "Habit name", 80)
        ensure(input.kind in KINDS) { "Unknown habit type: ${input.kind}" }
        ensure(input.unit in UNITS) { "Unknown unit: ${input.unit}" }
        ensure(input.timeOfDay in TIMES_OF_DAY) { "Unknown time of day: ${input.timeOfDay}" }
        ensure(input.days in 1..ALL_DAYS) { "Pick at least one day." }
        val goal =
            when {
                input.kind == "quit" -> {
                    0.0
                }

                input.goal == null || !input.goal.isFinite() || input.goal !in 0.0..100_000.0 -> {
                    invalid("That goal is out of range.")
                }

                input.kind == "build" && input.goal == 0.0 -> {
                    invalid("A goal must be more than zero.")
                }

                else -> {
                    input.goal
                }
            }
        ensure(input.skipDays in 0..MAX_SKIP_DAYS) { "Allow at most two skip days a week." }
        val anchor = optionalText(input.anchor, "Anchor", 120)
        val area = input.area.trim().codePoints().limit(40).toArray().let { String(it, 0, it.size) }
        var unit = input.unit
        val tracking =
            input.tracking?.let { tracking ->
                val patterns =
                    when (tracking.source) {
                        "website" -> tracking.patterns.map(::normalizeDomain).filter(String::isNotEmpty)
                        "app" -> tracking.patterns.map(String::trim).filter(String::isNotEmpty)
                        "project" -> emptyList()
                        else -> invalid("Unknown tracking source: ${tracking.source}")
                    }
                if (tracking.source == "project") {
                    projects.get(user, tracking.projectId ?: invalid("Pick a project to track."))
                    unit = "minutes"
                } else {
                    ensure(patterns.isNotEmpty()) {
                        if (tracking.source == "website") "Add at least one website." else "Add at least one app name."
                    }
                }
                Tracking(tracking.source, patterns, tracking.projectId.takeIf { tracking.source == "project" })
            }
        return Valid(name, goal, unit, area, anchor, tracking)
    }

    private fun write(user: Long, id: UUID, input: HabitInput, creating: Boolean): UUID {
        val valid = validate(user, input)
        val params =
            mapOf(
                "user" to user,
                "id" to id,
                "name" to valid.name,
                "kind" to input.kind,
                "goal" to valid.goal,
                "unit" to valid.unit,
                "days" to input.days,
                "timeOfDay" to input.timeOfDay,
                "area" to valid.area,
                "startDate" to input.startDate,
                "source" to valid.tracking?.source,
                "patterns" to valid.tracking?.patterns?.joinToString("\n").orEmpty(),
                "projectId" to valid.tracking?.projectId,
                "skipDays" to input.skipDays,
                "anchor" to valid.anchor,
            )
        if (creating) {
            jdbc
                .sql(
                    """
                    INSERT INTO habit (id, user_id, name, kind, goal, unit, days, time_of_day, area, start_date,
                                       track_source, track_patterns, track_project_id, skip_days, anchor, position)
                    VALUES (:id, :user, :name, :kind, :goal, :unit, :days, :timeOfDay, :area, :startDate,
                            CAST(:source AS TEXT), :patterns, CAST(:projectId AS UUID), :skipDays, :anchor,
                            (SELECT COALESCE(MAX(position), 0) + 1 FROM habit WHERE user_id = :user))
                    """,
                ).params(params)
                .update()
            return id
        }
        val rows =
            jdbc
                .sql(
                    """
                    UPDATE habit SET name = :name, kind = :kind, goal = :goal, unit = :unit, days = :days,
                                     time_of_day = :timeOfDay, area = :area, start_date = :startDate,
                                     track_source = CAST(:source AS TEXT), track_patterns = :patterns,
                                     track_project_id = CAST(:projectId AS UUID), skip_days = :skipDays,
                                     anchor = :anchor
                    WHERE user_id = :user AND id = :id
                    """,
                ).params(params)
                .update()
        ensureChanged(rows, "Habit")
        return id
    }

    private fun ensureLoggable(caller: Caller, date: LocalDate) {
        ensure(date <= caller.today()) { "Habits can't be logged ahead of time." }
    }

    private fun recordAuto(caller: Caller, habitId: UUID, date: LocalDate, value: Double) {
        jdbc
            .sql(
                """
                INSERT INTO habit_log (id, habit_id, date, value, source) VALUES (:id, :habit, :date, :value, 'auto')
                ON CONFLICT (habit_id, date) DO UPDATE SET value = excluded.value,
                  source = CASE WHEN habit_log.status IS NULL THEN 'auto' ELSE habit_log.source END
                """,
            ).param("id", NaturalIds.habitLog(caller.scopeId, habitId, date))
            .param("habit", habitId)
            .param("date", date)
            .param("value", value)
            .update()
    }

    private fun projectMinutes(caller: Caller, projectId: UUID, day: LocalDate): Double {
        val seconds =
            jdbc
                .sql(
                    """
                    WITH RECURSIVE tree(id) AS (
                      SELECT id FROM project WHERE user_id = :user AND id = :project
                      UNION ALL
                      SELECT p.id FROM project p JOIN tree ON p.parent_id = tree.id WHERE p.user_id = :user
                    )
                    SELECT COALESCE(SUM(LEAST(ended_at, :to) - GREATEST(started_at, :from)), 0) FROM time_entry
                    WHERE user_id = :user AND project_id IN (SELECT id FROM tree)
                      AND ended_at > :from AND started_at < :to
                    """,
                ).param("user", caller.id)
                .param("project", projectId)
                .param("from", caller.startOf(day))
                .param("to", caller.startOf(day.plusDays(1)))
                .query(Long::class.java)
                .single()
        return Math.round(seconds / 6.0) / 10.0
    }

    private fun syncWindow(habit: Habit, today: LocalDate): List<LocalDate> =
        datesBetween(maxOf(habit.startDate, today.minusDays(SYNC_DAYS)), today.plusDays(1))
}

private fun status(habit: Habit, date: LocalDate, today: LocalDate, log: Log?): DayStatus {
    if (date > today || date < habit.startDate) return DayStatus.OFF
    when (log?.status) {
        "done" -> return DayStatus.DONE
        "failed" -> return DayStatus.FAILED
        "skipped" -> return DayStatus.SKIPPED
    }
    if (habit.days and (1 shl (date.dayOfWeek.value - 1)) == 0) return DayStatus.OFF
    val value = log?.value ?: 0.0
    val past = date < today
    return when {
        habit.kind == "build" && value >= habit.goal -> DayStatus.DONE
        habit.kind == "build" -> if (past) DayStatus.MISSED else DayStatus.PENDING
        value > habit.goal -> DayStatus.FAILED
        past -> DayStatus.DONE
        else -> DayStatus.PENDING
    }
}

private fun normalizeDomain(pattern: String): String {
    val lower = pattern.trim().lowercase()
    var host = lower.substringAfter("://", lower).split('/', '?', '#').first()
    while (host.startsWith("www.")) host = host.removePrefix("www.")
    return host
}

private fun datesBetween(from: LocalDate, until: LocalDate): List<LocalDate> =
    if (from < until) from.datesUntil(until).toList() else emptyList()
