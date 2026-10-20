package com.skkil.time.features.review.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.intOrNull
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.review.domain.Day
import com.skkil.time.features.review.domain.Outcome
import com.skkil.time.features.review.domain.OutcomeStatus
import com.skkil.time.features.review.domain.Priority
import com.skkil.time.features.review.domain.Week
import com.skkil.time.features.review.domain.WeekNotes
import com.skkil.time.features.review.domain.WeekSummary
import com.skkil.time.features.review.domain.monday
import com.skkil.time.features.workflow.service.TaskWorkflowService
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

/** Day check-ins, weeks with their guided review, and weekly outcomes. */
@Service
@Transactional
class ReviewService(private val jdbc: JdbcClient, private val events: TaskWorkflowService) {
    @Transactional(readOnly = true)
    fun days(user: Long, from: LocalDate, to: LocalDate): List<Day> =
        jdbc
            .sql(
                """
                SELECT date, felt, reflection, skipped FROM day
                WHERE user_id = :user AND date >= :from AND date < :to ORDER BY date
                """,
            ).param("user", user)
            .param("from", from)
            .param("to", to)
            .query { rs, _ ->
                Day(
                    rs.getObject("date", LocalDate::class.java),
                    rs.intOrNull("felt"),
                    rs.getString("reflection"),
                    rs.getBoolean("skipped"),
                )
            }.list()

    fun setDayFelt(caller: Caller, date: LocalDate, felt: Int) {
        checkFelt(felt)
        checkPast(caller, date)
        jdbc
            .sql(
                """
                INSERT INTO day (id, user_id, date, felt) VALUES (:id, :user, :date, :felt)
                ON CONFLICT (user_id, date) DO UPDATE SET felt = excluded.felt, skipped = FALSE
                """,
            ).param("id", caller.nextId())
            .param("user", caller.id)
            .param("date", date)
            .param("felt", felt)
            .update()
    }

    fun setDayNote(caller: Caller, date: LocalDate, note: String) {
        checkPast(caller, date)
        val text = optionalText(note, "Note", 280)
        jdbc
            .sql(
                """
                INSERT INTO day (id, user_id, date, reflection) VALUES (:id, :user, :date, :note)
                ON CONFLICT (user_id, date) DO UPDATE SET reflection = excluded.reflection
                """,
            ).param("id", caller.nextId())
            .param("user", caller.id)
            .param("date", date)
            .param("note", text)
            .update()
    }

    fun skipDay(caller: Caller, date: LocalDate) {
        jdbc
            .sql(
                """
                INSERT INTO day (id, user_id, date, skipped) VALUES (:id, :user, :date, TRUE)
                ON CONFLICT (user_id, date) DO UPDATE SET skipped = TRUE
                """,
            ).param("id", caller.nextId())
            .param("user", caller.id)
            .param("date", date)
            .update()
    }

    @Transactional(readOnly = true)
    fun week(caller: Caller, date: LocalDate): Week {
        val start = date.monday()
        val week =
            jdbc
                .sql(
                    """
                    SELECT felt, step, reviewed_at, worked, fell_short, change
                    FROM week WHERE user_id = :user AND start_date = :start
                    """,
                ).param("user", caller.id)
                .param("start", start)
                .query { rs, _ ->
                    Week(
                        start,
                        rs.intOrNull("felt"),
                        rs.getInt("step"),
                        rs.longOrNull("reviewed_at"),
                        WeekNotes(rs.getString("worked"), rs.getString("fell_short"), rs.getString("change")),
                        emptyList(),
                    )
                }.optional()
                .orElse(Week(start, null, 0, null, WeekNotes(), emptyList()))
        return week.copy(outcomes = outcomes(caller, start))
    }

    @Transactional(readOnly = true)
    fun weeks(caller: Caller, from: LocalDate, to: LocalDate): List<WeekSummary> =
        generateSequence(to.minusDays(1).monday()) { it.minusWeeks(1) }
            .takeWhile { it >= from.monday() }
            .map { summary(caller, it) }
            .toList()

    fun saveNotes(caller: Caller, date: LocalDate, notes: WeekNotes) {
        fun text(value: String) = optionalText(value, "Reflection", 2_000)
        jdbc
            .sql(
                """
                INSERT INTO week (id, user_id, start_date, worked, fell_short, change)
                VALUES (:id, :user, :start, :worked, :fellShort, :change)
                ON CONFLICT (user_id, start_date) DO UPDATE SET
                  worked = excluded.worked, fell_short = excluded.fell_short, change = excluded.change
                """,
            ).param("id", caller.nextId())
            .param("user", caller.id)
            .param("start", date.monday())
            .param("worked", text(notes.worked))
            .param("fellShort", text(notes.fellShort))
            .param("change", text(notes.change))
            .update()
    }

    fun setWeekFelt(caller: Caller, date: LocalDate, felt: Int) {
        checkFelt(felt)
        updateWeek(caller, date, "felt = :value", felt)
    }

    fun setWeekStep(caller: Caller, date: LocalDate, step: Int) {
        ensure(step in 0..LAST_STEP) { "That review step doesn't exist." }
        updateWeek(caller, date, "step = GREATEST(step, :value)", step)
    }

    fun finishWeek(caller: Caller, date: LocalDate) {
        val start = date.monday()
        ensureWeek(caller, start)
        jdbc
            .sql(
                """
                UPDATE week SET step = :step, reviewed_at = COALESCE(reviewed_at, :now)
                WHERE user_id = :user AND start_date = :start
                """,
            ).param("step", LAST_STEP)
            .param("now", caller.now())
            .param("user", caller.id)
            .param("start", start)
            .update()
    }

    fun addOutcome(caller: Caller, date: LocalDate, title: String, priorityId: UUID?, id: UUID? = null) {
        val text = requiredText(title, "Outcome", 200)
        priorityId?.let { ensurePriority(caller.id, it) }
        insertOutcome(caller, date.monday(), text, priorityId, null, id)
    }

    fun renameOutcome(user: Long, id: UUID, title: String, priorityId: UUID?) {
        val text = requiredText(title, "Outcome", 200)
        priorityId?.let { ensurePriority(user, it) }
        val rows =
            jdbc
                .sql(
                    """
                    UPDATE outcome SET title = :title, priority_id = CAST(:priority AS UUID)
                    WHERE user_id = :user AND id = :id
                    """,
                ).param("title", text)
                .param("priority", priorityId)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Outcome")
    }

    fun setOutcomeStatus(caller: Caller, id: UUID, status: OutcomeStatus) {
        val user = caller.id
        val (start, current) =
            jdbc
                .sql("SELECT week_start, status FROM outcome WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .query { rs, _ ->
                    rs.getObject("week_start", LocalDate::class.java) to OutcomeStatus.parse(rs.getString("status"))
                }.optional()
                .orElse(null)
                .orNotFound("Outcome")
        if (current == status) return
        if (status == OutcomeStatus.OPEN && openOutcomes(user, start, id) >= MAX_OPEN_OUTCOMES) {
            invalid(TOO_MANY_OUTCOMES)
        }
        if (current == OutcomeStatus.CARRIED) uncarry(user, id)
        if (status == OutcomeStatus.CARRIED) {
            ensure(timesCarried(user, id) < MAX_CARRIES) {
                "Carried twice already. Shrink it, give it a new date, or drop it."
            }
            carry(caller, id, start)
        }
        jdbc
            .sql("UPDATE outcome SET status = :status WHERE user_id = :user AND id = :id")
            .param("status", status.value)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun deleteOutcome(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM outcome WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Outcome")
    }

    private fun outcomes(caller: Caller, start: LocalDate): List<Outcome> =
        jdbc
            .sql(
                """
                SELECT o.id, o.title, o.status, o.priority_id, o.carried_from,
                  (SELECT COUNT(*) FROM task t WHERE t.user_id = o.user_id AND t.outcome_id = o.id) AS total,
                  (SELECT COUNT(*) FROM task t
                    WHERE t.user_id = o.user_id AND t.outcome_id = o.id AND t.completed_at IS NOT NULL) AS done,
                  (SELECT COALESCE(SUM(e.ended_at - e.started_at), 0)::BIGINT
                     FROM time_entry e JOIN task t ON t.id = e.task_id
                    WHERE e.user_id = o.user_id AND t.outcome_id = o.id
                      AND e.started_at >= :from AND e.started_at < :to) AS tracked
                FROM outcome o WHERE o.user_id = :user AND o.week_start = :start ORDER BY o.id
                """,
            ).param("from", caller.startOf(start))
            .param("to", caller.startOf(start.plusDays(7)))
            .param("user", caller.id)
            .param("start", start)
            .query { rs, _ ->
                Outcome(
                    rs.uuid("id"),
                    rs.getString("title"),
                    OutcomeStatus.parse(rs.getString("status")),
                    rs.uuidOrNull("priority_id"),
                    rs.uuidOrNull("carried_from"),
                    0,
                    rs.getInt("total"),
                    rs.getInt("done"),
                    rs.getLong("tracked"),
                )
            }.list()
            .map { it.copy(timesCarried = timesCarried(caller.id, it.id)) }

    private fun timesCarried(user: Long, id: UUID): Int =
        jdbc
            .sql(
                """
                WITH RECURSIVE chain(id, previous) AS (
                  SELECT id, carried_from FROM outcome WHERE user_id = :user AND id = :id
                  UNION ALL
                  SELECT o.id, o.carried_from FROM outcome o JOIN chain ON o.id = chain.previous
                  WHERE o.user_id = :user
                )
                SELECT COUNT(*) - 1 FROM chain
                """,
            ).param("user", user)
            .param("id", id)
            .query(Int::class.java)
            .single()

    private fun summary(caller: Caller, start: LocalDate): WeekSummary {
        val end = start.plusDays(7)
        val now = caller.now()
        val eventSeconds =
            events
                .occurrences(caller, start, end)
                .filter { it.countsAsTime && it.endAt <= now }
                .sumOf { it.endAt - it.startAt }
        return jdbc
            .sql(
                """
                SELECT w.felt, COALESCE(w.step, 0) AS step, w.reviewed_at,
                  (SELECT COUNT(*) FROM outcome o WHERE o.user_id = :user AND o.week_start = :start) AS total,
                  (SELECT COUNT(*) FROM outcome o
                    WHERE o.user_id = :user AND o.week_start = :start AND o.status = 'achieved') AS achieved,
                  (SELECT COALESCE(SUM(ended_at - started_at), 0)::BIGINT FROM time_entry
                    WHERE user_id = :user AND started_at >= :from AND started_at < :to) AS tracked,
                  (SELECT COALESCE(SUM(end_at - start_at), 0)::BIGINT FROM time_block
                    WHERE user_id = :user AND start_at >= :from AND start_at < :to)
                  + (SELECT COALESCE(SUM(COALESCE(t.estimate_minutes, :timedMinutes)), 0)::BIGINT * 60 FROM task t
                      WHERE t.user_id = :user AND t.due_date >= :start AND t.due_date < :end
                        AND t.due_time IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM time_block b WHERE b.task_id = t.id)
                        AND NOT EXISTS (SELECT 1 FROM item_type ty WHERE ty.id = t.type_id AND ty.kind = 'event'))
                    AS planned,
                  (SELECT COUNT(*) FROM task
                    WHERE user_id = :user AND completed_at >= :from AND completed_at < :to) AS completed
                FROM (SELECT 1) AS one
                LEFT JOIN week w ON w.user_id = :user AND w.start_date = :start
                """,
            ).param("user", caller.id)
            .param("start", start)
            .param("end", end)
            .param("from", caller.startOf(start))
            .param("to", caller.startOf(end))
            .param("timedMinutes", TIMED_TASK_MINUTES)
            .query { rs, _ ->
                WeekSummary(
                    start,
                    rs.intOrNull("felt"),
                    rs.getInt("step"),
                    rs.longOrNull("reviewed_at"),
                    rs.getInt("total"),
                    rs.getInt("achieved"),
                    rs.getLong("tracked") + eventSeconds,
                    rs.getLong("planned"),
                    rs.getInt("completed"),
                )
            }.single()
    }

    private fun updateWeek(caller: Caller, date: LocalDate, assignment: String, value: Int) {
        val start = date.monday()
        ensureWeek(caller, start)
        jdbc
            .sql("UPDATE week SET $assignment WHERE user_id = :user AND start_date = :start")
            .param("value", value)
            .param("user", caller.id)
            .param("start", start)
            .update()
    }

    private fun ensureWeek(caller: Caller, start: LocalDate) {
        jdbc
            .sql(
                "INSERT INTO week (id, user_id, start_date) VALUES (:id, :user, :start) " +
                    "ON CONFLICT (user_id, start_date) DO NOTHING",
            ).param("id", caller.nextId())
            .param("user", caller.id)
            .param("start", start)
            .update()
    }

    private fun openOutcomes(user: Long, start: LocalDate, except: UUID?): Int =
        jdbc
            .sql(
                """
                SELECT COUNT(*) FROM outcome
                WHERE user_id = :user AND week_start = :start AND status = 'open'
                  AND id IS DISTINCT FROM CAST(:except AS UUID)
                """,
            ).param("user", user)
            .param("start", start)
            .param("except", except)
            .query(Int::class.java)
            .single()

    private fun insertOutcome(
        caller: Caller,
        start: LocalDate,
        title: String,
        priorityId: UUID?,
        carriedFrom: UUID?,
        id: UUID? = null,
    ): UUID {
        if (openOutcomes(caller.id, start, null) >= MAX_OPEN_OUTCOMES) invalid(TOO_MANY_OUTCOMES)
        ensureWeek(caller, start)
        val id = id ?: caller.nextId()
        jdbc
            .sql(
                """
                INSERT INTO outcome (id, user_id, week_start, title, priority_id, carried_from)
                VALUES (:id, :user, :start, :title, CAST(:priority AS UUID), CAST(:carriedFrom AS UUID))
                """,
            ).param("id", id)
            .param("user", caller.id)
            .param("start", start)
            .param("title", title)
            .param("priority", priorityId)
            .param("carriedFrom", carriedFrom)
            .update()
        return id
    }

    private fun carry(caller: Caller, id: UUID, start: LocalDate) {
        val user = caller.id
        val (title, priorityId) =
            jdbc
                .sql("SELECT title, priority_id FROM outcome WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .query { rs, _ -> rs.getString("title") to rs.uuidOrNull("priority_id") }
                .single()
        val next = insertOutcome(caller, start.plusDays(7), title, priorityId, id)
        jdbc
            .sql(
                """
                UPDATE task SET outcome_id = :next
                WHERE user_id = :user AND outcome_id = :id AND completed_at IS NULL
                """,
            ).param("next", next)
            .param("user", user)
            .param("id", id)
            .update()
    }

    private fun uncarry(user: Long, id: UUID) {
        val next =
            jdbc
                .sql("SELECT id FROM outcome WHERE user_id = :user AND carried_from = :id")
                .param("user", user)
                .param("id", id)
                .query(UUID::class.java)
                .optional()
                .orElse(null) ?: return
        jdbc
            .sql("UPDATE task SET outcome_id = :id WHERE user_id = :user AND outcome_id = :next")
            .param("id", id)
            .param("user", user)
            .param("next", next)
            .update()
        jdbc
            .sql("DELETE FROM outcome WHERE user_id = :user AND id = :next")
            .param("user", user)
            .param("next", next)
            .update()
    }

    private fun ensurePriority(user: Long, id: UUID) {
        jdbc
            .sql("SELECT id FROM priority WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(UUID::class.java)
            .optional()
            .orElse(null)
            .orNotFound("Priority")
    }

    private fun checkFelt(felt: Int) = ensure(felt in 1..5) { "Rate it from 1 to 5." }

    private fun checkPast(caller: Caller, date: LocalDate) =
        ensure(date <= caller.today()) { "That day hasn't happened yet." }

    private companion object {
        const val MAX_OPEN_OUTCOMES = 3
        const val MAX_CARRIES = 2
        const val LAST_STEP = 6
        const val TIMED_TASK_MINUTES = 60
        const val TOO_MANY_OUTCOMES = "3 outcomes max. Finish or drop one first."
    }
}
