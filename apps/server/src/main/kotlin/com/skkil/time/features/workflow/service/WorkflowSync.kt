package com.skkil.time.features.workflow.service

import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import java.util.UUID

/** Keeps each task's type, status, phase and milestone pointing at its own project, and completion in step with status. */
@Component
class WorkflowSync(private val jdbc: JdbcClient) {
    /** After tasks move or statuses appear: map type and phase by name, status by category, and fill missing statuses. */
    fun reconcile(user: Long) {
        update(
            user,
            """
            UPDATE task SET type_id = (
              SELECT n.id FROM item_type n JOIN item_type o ON o.id = task.type_id
               WHERE n.project_id = task.project_id AND n.name = o.name
               ORDER BY n.position, n.id LIMIT 1)
            WHERE user_id = :user AND type_id IS NOT NULL
              AND (SELECT project_id FROM item_type WHERE id = task.type_id) IS DISTINCT FROM task.project_id
            """,
        )
        movedPhases(user).forEach { (taskId, from, to) ->
            jdbc
                .sql(
                    """
                    UPDATE record_phase SET status_id = :to
                    WHERE task_id = :task AND status_id = :from
                      AND NOT EXISTS (SELECT 1 FROM record_phase r WHERE r.task_id = :task AND r.status_id = :to)
                    """,
                ).param("to", to)
                .param("task", taskId)
                .param("from", from)
                .update()
        }
        update(
            user,
            """
            UPDATE task SET phase_id = (
              SELECT n.id FROM item_status n JOIN item_status o ON o.id = task.phase_id
               WHERE n.project_id = task.project_id AND n.name = o.name
               ORDER BY n.position, n.id LIMIT 1)
            WHERE user_id = :user AND phase_id IS NOT NULL
              AND (SELECT project_id FROM item_status WHERE id = task.phase_id) IS DISTINCT FROM task.project_id
            """,
        )
        update(
            user,
            """
            UPDATE task SET milestone_id = NULL
            WHERE user_id = :user AND milestone_id IS NOT NULL
              AND (SELECT project_id FROM milestone WHERE id = task.milestone_id) IS DISTINCT FROM task.project_id
            """,
        )
        update(
            user,
            """
            UPDATE task SET status_id = (
              SELECT n.id FROM item_status n JOIN item_status o ON o.id = task.status_id
               WHERE n.project_id = task.project_id AND n.category = o.category
               ORDER BY n.position, n.id LIMIT 1)
            WHERE user_id = :user AND status_id IS NOT NULL
              AND (SELECT project_id FROM item_status WHERE id = task.status_id) IS DISTINCT FROM task.project_id
            """,
        )
        update(
            user,
            """
            UPDATE task SET status_id = (
              SELECT s.id FROM item_status s
               WHERE s.project_id = task.project_id
               ORDER BY CASE WHEN task.completed_at IS NOT NULL THEN s.category <> 'done' ELSE s.category <> 'todo' END,
                 s.category IN ('done', 'dropped'), s.position, s.id
               LIMIT 1)
            WHERE user_id = :user AND status_id IS NULL AND project_id IS NOT NULL
            """,
        )
    }

    /** Closes tasks whose status is done or dropped and reopens the rest, for the tasks [filter] picks. */
    fun syncCompletion(user: Long, now: Long, filter: String, name: String, value: UUID) {
        jdbc
            .sql(
                """
                UPDATE task SET completed_at = CASE
                  WHEN (SELECT category FROM item_status WHERE id = task.status_id) IN ('done', 'dropped')
                    THEN COALESCE(completed_at, :now)
                  ELSE NULL END
                WHERE user_id = :user AND status_id IS NOT NULL AND $filter
                """,
            ).param("now", now)
            .param("user", user)
            .param(name, value)
            .update()
    }

    /** Moves a task checked off (or reopened) to its project's first done (or todo) status. */
    fun statusForCompletion(user: Long, taskId: UUID, completed: Boolean, now: Long) {
        val wanted = if (completed) listOf("done") else listOf("todo", "active", "backlog")
        jdbc
            .sql(
                """
                UPDATE task SET status_id = (
                  SELECT s.id FROM item_status s
                   WHERE s.project_id = task.project_id AND s.category IN (:wanted)
                   ORDER BY s.category <> :first, s.position, s.id LIMIT 1),
                  status_changed_at = :now
                WHERE user_id = :user AND id = :id
                  AND EXISTS (SELECT 1 FROM item_status s WHERE s.project_id = task.project_id)
                  AND COALESCE((SELECT category FROM item_status WHERE id = task.status_id) IN ('done', 'dropped'), FALSE)
                      <> :completed
                """,
            ).param("wanted", wanted)
            .param("first", wanted.first())
            .param("now", now)
            .param("user", user)
            .param("id", taskId)
            .param("completed", completed)
            .update()
    }

    private fun movedPhases(user: Long): List<Triple<UUID, UUID, UUID>> =
        jdbc
            .sql(
                """
                SELECT r.task_id, r.status_id,
                  (SELECT n.id FROM item_status n
                    WHERE n.project_id = t.project_id AND n.name = o.name
                    ORDER BY n.position, n.id LIMIT 1) AS target
                FROM record_phase r
                JOIN task t ON t.id = r.task_id
                JOIN item_status o ON o.id = r.status_id
                WHERE t.user_id = :user AND o.project_id IS DISTINCT FROM t.project_id
                """,
            ).param("user", user)
            .query { rs, _ ->
                rs.uuidOrNull("target")?.let { Triple(rs.uuid("task_id"), rs.uuid("status_id"), it) }
            }.list()
            .filterNotNull()

    private fun update(user: Long, sql: String) {
        jdbc.sql(sql).param("user", user).update()
    }
}
