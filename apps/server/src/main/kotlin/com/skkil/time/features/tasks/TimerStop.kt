package com.skkil.time.features.tasks

import com.skkil.time.common.longOrNull
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component

/** Stops the running timer when it tracks one of the given tasks, logging the stretch so far as an entry. */
@Component
class TimerStop(private val jdbc: JdbcClient) {
    private data class Running(val taskId: Long, val description: String, val startedAt: Long, val pausedAt: Long?)

    fun stopFor(user: Long, now: Long, tasks: List<Long>) {
        val running =
            jdbc
                .sql(
                    """
                    SELECT task_id, description, started_at, paused_at FROM running_timer
                    WHERE user_id = :user AND task_id IN (:tasks)
                    """,
                ).param("user", user)
                .param("tasks", tasks)
                .query { rs, _ ->
                    Running(
                        rs.getLong("task_id"),
                        rs.getString("description"),
                        rs.getLong("started_at"),
                        rs.longOrNull("paused_at"),
                    )
                }.optional()
                .orElse(null) ?: return
        val startedAt = maxOf(running.startedAt, now - TaskRules.DAY_SECONDS)
        if (running.pausedAt == null && now - startedAt >= 1) {
            jdbc
                .sql(
                    """
                    INSERT INTO time_entry (user_id, description, project_id, task_id, started_at, ended_at)
                    SELECT :user, :description, project_id, id, :startedAt, :now FROM task WHERE id = :task AND user_id = :user
                    """,
                ).param("user", user)
                .param("description", running.description)
                .param("startedAt", startedAt)
                .param("now", now)
                .param("task", running.taskId)
                .update()
        }
        jdbc.sql("DELETE FROM running_timer WHERE user_id = :user").param("user", user).update()
    }
}
