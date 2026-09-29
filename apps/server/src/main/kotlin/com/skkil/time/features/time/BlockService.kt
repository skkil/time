package com.skkil.time.features.time

import com.skkil.time.common.Caller
import com.skkil.time.common.ensure
import com.skkil.time.common.ensureChanged
import com.skkil.time.common.longOrNull
import com.skkil.time.common.orNotFound
import com.skkil.time.features.tasks.TaskService
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/** Planned spans for a task on the schedule grid. */
@Service
@Transactional
class BlockService(private val jdbc: JdbcClient, private val tasks: TaskService) {
    @Transactional(readOnly = true)
    fun list(caller: Caller, from: LocalDate, to: LocalDate): List<TimeBlock> =
        jdbc
            .sql("$SELECT WHERE b.user_id = :user AND b.start_at >= :from AND b.start_at < :to ORDER BY b.start_at")
            .param("user", caller.id)
            .param("from", caller.startOf(from))
            .param("to", caller.startOf(to))
            .query(mapper)
            .list()

    fun create(user: Long, taskId: Long, span: BlockSpan): TimeBlock {
        validate(span)
        tasks.get(user, taskId)
        val id =
            jdbc
                .sql(
                    """
                    INSERT INTO time_block (user_id, task_id, start_at, end_at) VALUES (:user, :task, :start, :end)
                    RETURNING id
                    """,
                ).param("user", user)
                .param("task", taskId)
                .param("start", span.startAt)
                .param("end", span.endAt)
                .query(Long::class.java)
                .single()
        return get(user, id)
    }

    fun reschedule(user: Long, id: Long, span: BlockSpan): TimeBlock {
        validate(span)
        val rows =
            jdbc
                .sql("UPDATE time_block SET start_at = :start, end_at = :end WHERE user_id = :user AND id = :id")
                .param("start", span.startAt)
                .param("end", span.endAt)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Time block")
        return get(user, id)
    }

    fun delete(user: Long, id: Long) {
        val rows =
            jdbc
                .sql("DELETE FROM time_block WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Time block")
    }

    private fun get(user: Long, id: Long): TimeBlock =
        jdbc
            .sql("$SELECT WHERE b.user_id = :user AND b.id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Time block")

    private fun validate(span: BlockSpan) {
        ensure(span.startAt % TimeRules.MINUTE == 0L && span.endAt % TimeRules.MINUTE == 0L) {
            "Blocks start and end on whole minutes."
        }
        val length = span.endAt - span.startAt
        ensure(length > 0) { "A block must end after it starts." }
        ensure(length <= TimeRules.DAY_SECONDS) { "A block can't be longer than 24 hours." }
    }

    private companion object {
        const val SELECT = """
            SELECT b.id, b.task_id, t.title, t.project_id, t.priority, t.completed_at IS NOT NULL AS completed,
                   b.start_at, b.end_at
            FROM time_block b JOIN task t ON t.id = b.task_id
        """
        val mapper =
            RowMapper { rs, _ ->
                TimeBlock(
                    rs.getLong("id"),
                    rs.getLong("task_id"),
                    rs.getString("title"),
                    rs.longOrNull("project_id"),
                    rs.getInt("priority"),
                    rs.getBoolean("completed"),
                    rs.getLong("start_at"),
                    rs.getLong("end_at"),
                )
            }
    }
}
