package com.skkil.time.features.glance.service

import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.glance.domain.Glance
import com.skkil.time.features.glance.domain.GlanceItem
import com.skkil.time.features.glance.domain.GlanceKind
import com.skkil.time.features.glance.domain.GlanceTask
import com.skkil.time.features.time.service.TimerService
import com.skkil.time.features.workflow.service.TaskWorkflowService
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** Today at a glance, by the same rules as time-core's `glance::today_glance`. */
@Service
@Transactional(readOnly = true)
class GlanceService(
    private val jdbc: JdbcClient,
    private val timers: TimerService,
    private val workflow: TaskWorkflowService,
) {
    fun today(caller: Caller): Glance {
        val now = caller.now()
        val today = caller.today()
        val endOfDay = caller.at(today.plusDays(1), 0)
        val happening = mutableListOf<GlanceItem>()
        jdbc
            .sql(
                """
                SELECT t.title, b.task_id, b.start_at, b.end_at FROM time_block b
                JOIN task t ON t.id = b.task_id
                WHERE b.user_id = :user AND b.end_at > :now AND b.start_at < :end
                  AND t.completed_at IS NULL AND NOT t.someday
                ORDER BY b.start_at, b.id
                """,
            ).param("user", caller.id)
            .param("now", now)
            .param("end", endOfDay)
            .query { rs, _ ->
                GlanceItem(
                    GlanceKind.BLOCK,
                    rs.getString("title"),
                    rs.uuid("task_id"),
                    rs.getLong("start_at"),
                    rs.getLong("end_at"),
                )
            }.list()
            .let(happening::addAll)
        jdbc
            .sql(
                """
                SELECT t.title, t.id, t.due_time FROM task t
                LEFT JOIN item_type ty ON ty.id = t.type_id
                LEFT JOIN project p ON p.id = t.project_id
                WHERE t.user_id = :user AND t.due_date = :today AND t.due_time IS NOT NULL
                  AND t.completed_at IS NULL AND NOT t.someday AND COALESCE(ty.kind, 'task') = 'task'
                  AND (p.id IS NULL OR NOT p.archived)
                ORDER BY t.due_time, t.position, t.id
                """,
            ).param("user", caller.id)
            .param("today", today)
            .query { rs, _ ->
                GlanceItem(
                    GlanceKind.TASK,
                    rs.getString("title"),
                    rs.uuid("id"),
                    caller.at(today, rs.getInt("due_time")),
                    null,
                )
            }.list()
            .let(happening::addAll)
        workflow
            .occurrences(caller, today, today.plusDays(1))
            .filter { it.endAt > now }
            .mapTo(happening) { GlanceItem(GlanceKind.EVENT, it.title, it.taskId, it.startAt, it.endAt) }
        val ordered = happening.sortedBy { it.startsAt }
        return Glance(
            timer = timers.running(caller.id),
            now = ordered.firstOrNull { it.endsAt != null && it.startsAt <= now },
            next = ordered.firstOrNull { it.startsAt > now },
            musts = musts(caller),
            earlierCount = earlierCount(caller),
        )
    }

    private fun musts(caller: Caller): List<GlanceTask> =
        jdbc
            .sql(
                """
                SELECT t.id, t.title FROM task t
                LEFT JOIN project p ON p.id = t.project_id
                WHERE t.user_id = :user AND t.must_on = :today AND t.completed_at IS NULL
                  AND (p.id IS NULL OR NOT p.archived)
                ORDER BY t.priority, t.position, t.id
                LIMIT :limit
                """,
            ).param("user", caller.id)
            .param("today", caller.today())
            .param("limit", MAX_MUSTS)
            .query { rs, _ -> GlanceTask(rs.uuid("id"), rs.getString("title")) }
            .list()

    private fun earlierCount(caller: Caller): Int =
        jdbc
            .sql(
                """
                SELECT COUNT(*) FROM task t
                LEFT JOIN item_type ty ON ty.id = t.type_id
                LEFT JOIN item_status st ON st.id = t.status_id
                LEFT JOIN project p ON p.id = t.project_id
                WHERE t.user_id = :user AND t.completed_at IS NULL AND NOT t.someday
                  AND COALESCE(ty.kind, 'task') = 'task'
                  AND COALESCE(st.category, '') <> 'backlog'
                  AND COALESCE(t.due_until, t.due_date) < :today
                  AND t.must_on IS DISTINCT FROM :today
                  AND (p.id IS NULL OR NOT p.archived)
                """,
            ).param("user", caller.id)
            .param("today", caller.today())
            .query(Int::class.java)
            .single()

    private companion object {
        const val MAX_MUSTS = 3
    }
}
