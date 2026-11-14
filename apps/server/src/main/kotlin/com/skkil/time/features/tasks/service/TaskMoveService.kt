package com.skkil.time.features.tasks.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.invalid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.domain.MoveResult
import com.skkil.time.features.tasks.domain.MoveTarget
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters
import java.util.UUID

/** Moves tasks to a day or a week, taking their upcoming time blocks along. */
@Service
@Transactional
class TaskMoveService(private val jdbc: JdbcClient, private val tasks: TaskService) {
    fun move(caller: Caller, ids: List<UUID>, target: MoveTarget, blocks: String?): MoveResult {
        val follow =
            when (blocks ?: FOLLOW) {
                FOLLOW -> true
                LEAVE -> false
                else -> invalid("Blocks either follow or stay.")
            }
        val (dueDate, dueUntil) = dates(target)
        val now = caller.now()
        var moved = 0
        var blocksMoved = 0
        for (id in ids.distinct()) {
            val task = tasks.get(caller.id, id)
            if (target !is MoveTarget.Day) {
                ensure(task.kind != "event") { "Events happen at a time; give them a new date." }
                ensure(task.recurrence == null) { "Repeating tasks move one day at a time." }
            }
            jdbc
                .sql(
                    """
                    UPDATE task SET due_date = CAST(:due AS DATE),
                      due_until = CAST(:until AS DATE),
                      due_time = CASE WHEN CAST(:until AS DATE) IS NULL THEN due_time END,
                      must_on = CASE WHEN must_on BETWEEN CAST(:due AS DATE)
                        AND COALESCE(CAST(:until AS DATE), CAST(:due AS DATE)) THEN must_on END
                    WHERE user_id = :user AND id = :id
                    """,
                ).param("due", dueDate)
                .param("until", dueUntil)
                .param("user", caller.id)
                .param("id", id)
                .update()
            moved++
            if (!follow) continue
            val from = task.dueDate ?: continue
            val days =
                if (dueUntil != null || task.dueUntil != null) {
                    ChronoUnit.DAYS.between(monday(from), monday(dueDate))
                } else {
                    ChronoUnit.DAYS.between(from, dueDate)
                }
            if (days != 0L) blocksMoved += shiftUpcoming(caller.id, id, now, days)
        }
        return MoveResult(moved, blocksMoved)
    }

    private fun dates(target: MoveTarget): Pair<LocalDate, LocalDate?> =
        when (target) {
            is MoveTarget.Day -> {
                Pair(target.date, null)
            }

            is MoveTarget.Week -> {
                ensure(target.monday.dayOfWeek == DayOfWeek.MONDAY) { "A week starts on a Monday." }
                Pair(target.monday, target.monday.plusDays(WEEK_DAYS - 1))
            }
        }

    private fun monday(date: LocalDate): LocalDate = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

    private fun shiftUpcoming(user: Long, task: UUID, from: Long, days: Long): Int =
        jdbc
            .sql(
                """
                UPDATE time_block SET start_at = start_at + :seconds, end_at = end_at + :seconds
                WHERE user_id = :user AND task_id = :task AND start_at >= :from
                """,
            ).param("seconds", days * DAY_SECONDS)
            .param("user", user)
            .param("task", task)
            .param("from", from)
            .update()

    private companion object {
        const val FOLLOW = "follow"
        const val LEAVE = "leave"
        const val WEEK_DAYS = 7L
        const val DAY_SECONDS = 24L * 60 * 60
    }
}
