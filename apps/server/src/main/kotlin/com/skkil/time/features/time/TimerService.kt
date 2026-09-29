package com.skkil.time.features.time

import com.skkil.time.common.invalid
import com.skkil.time.common.longOrNull
import com.skkil.time.features.projects.ProjectService
import com.skkil.time.features.tasks.TaskRepository
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * The running timer, one row per user. Stopping turns it into an entry; a break logs the stretch so far and
 * banks its seconds, and resuming starts a new stretch.
 */
@Service
@Transactional
class TimerService(
    private val jdbc: JdbcClient,
    private val entries: EntryService,
    private val tasks: TaskRepository,
    private val projects: ProjectService,
) {
    @Transactional(readOnly = true)
    fun running(user: Long): RunningTimer? =
        jdbc
            .sql(
                """
                SELECT description, project_id, task_id, started_at, paused_at, banked_seconds
                FROM running_timer WHERE user_id = :user
                """,
            ).param("user", user)
            .query { rs, _ ->
                RunningTimer(
                    rs.getString("description"),
                    rs.longOrNull("project_id"),
                    rs.longOrNull("task_id"),
                    rs.getLong("started_at"),
                    rs.longOrNull("paused_at"),
                    rs.getLong("banked_seconds"),
                )
            }.optional()
            .orElse(null)

    fun start(user: Long, now: Long, details: EntryDetails): RunningTimer {
        val resolved = entries.resolve(user, details)
        running(user)?.let { finish(user, now, it) }
        return save(user, RunningTimer(resolved.description, resolved.projectId, resolved.taskId, now, null, 0))
    }

    fun pause(user: Long, now: Long): RunningTimer {
        val current = current(user)
        if (current.pausedAt != null) return current
        val banked = finish(user, now, current)?.let { it.endedAt - it.startedAt } ?: 0
        return save(user, current.copy(pausedAt = now, bankedSeconds = current.bankedSeconds + banked))
    }

    fun resume(user: Long, now: Long): RunningTimer {
        val current = current(user)
        if (current.pausedAt == null) return current
        return save(user, current.copy(startedAt = now, pausedAt = null))
    }

    fun edit(user: Long, details: EntryDetails): RunningTimer {
        val resolved = entries.resolve(user, details)
        val current = current(user)
        return save(
            user,
            current.copy(
                description = resolved.description,
                projectId = resolved.projectId,
                taskId = resolved.taskId,
            ),
        )
    }

    fun stop(user: Long, now: Long): TimeEntry? {
        val current = running(user) ?: return null
        val entry = finish(user, now, current)
        discard(user)
        return entry
    }

    /** Stops the timer when it tracks one of [taskIds]. */
    fun stopFor(user: Long, now: Long, taskIds: List<Long>) {
        if (running(user)?.taskId?.let { it in taskIds } == true) stop(user, now)
    }

    fun discard(user: Long) {
        jdbc.sql("DELETE FROM running_timer WHERE user_id = :user").param("user", user).update()
    }

    fun restore(user: Long, timer: RunningTimer): RunningTimer {
        if (running(user) != null) invalid("Another timer is running, so this can't be undone.")
        timer.taskId?.let { tasks.get(user, it) }
        timer.projectId?.let { projects.get(user, it) }
        return save(user, timer)
    }

    private fun current(user: Long): RunningTimer = running(user) ?: invalid("No timer is running.")

    private fun finish(user: Long, now: Long, running: RunningTimer): TimeEntry? {
        if (running.pausedAt != null) return null
        val startedAt = maxOf(running.startedAt, now - TimeRules.DAY_SECONDS)
        if (now - startedAt < 1) return null
        val input = EntryInput(running.description, running.projectId, running.taskId, startedAt, now)
        return entries.create(user, now, input)
    }

    private fun save(user: Long, timer: RunningTimer): RunningTimer {
        jdbc
            .sql(
                """
                INSERT INTO running_timer (user_id, description, project_id, task_id, started_at, paused_at,
                                           banked_seconds)
                VALUES (:user, :description, :project, :task, :startedAt, :pausedAt, :banked)
                ON CONFLICT (user_id) DO UPDATE SET
                  description = EXCLUDED.description, project_id = EXCLUDED.project_id, task_id = EXCLUDED.task_id,
                  started_at = EXCLUDED.started_at, paused_at = EXCLUDED.paused_at,
                  banked_seconds = EXCLUDED.banked_seconds
                """,
            ).param("user", user)
            .param("description", timer.description)
            .param("project", timer.projectId)
            .param("task", timer.taskId)
            .param("startedAt", timer.startedAt)
            .param("pausedAt", timer.pausedAt)
            .param("banked", timer.bankedSeconds)
            .update()
        return timer
    }
}
