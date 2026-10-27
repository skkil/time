package com.skkil.time.features.time.service

import com.skkil.time.common.error.invalid
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.tasks.repository.TaskRepository
import com.skkil.time.features.time.domain.EntryDetails
import com.skkil.time.features.time.domain.EntryInput
import com.skkil.time.features.time.domain.RunningTimer
import com.skkil.time.features.time.domain.TimeEntry
import com.skkil.time.features.time.domain.TimeRules
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

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
                    rs.uuidOrNull("project_id"),
                    rs.uuidOrNull("task_id"),
                    rs.getLong("started_at"),
                    rs.longOrNull("paused_at"),
                    rs.getLong("banked_seconds"),
                )
            }.optional()
            .orElse(null)

    fun start(caller: Caller, details: EntryDetails): RunningTimer {
        val resolved = entries.resolve(caller.id, details)
        running(caller.id)?.let { finish(caller, it) }
        val timer = RunningTimer(resolved.description, resolved.projectId, resolved.taskId, caller.now(), null, 0)
        return save(caller, timer)
    }

    fun pause(caller: Caller): RunningTimer {
        val current = current(caller.id)
        if (current.pausedAt != null) return current
        val banked = finish(caller, current)?.let { it.endedAt - it.startedAt } ?: 0
        return save(caller, current.copy(pausedAt = caller.now(), bankedSeconds = current.bankedSeconds + banked))
    }

    fun resume(caller: Caller): RunningTimer {
        val current = current(caller.id)
        if (current.pausedAt == null) return current
        return save(caller, current.copy(startedAt = caller.now(), pausedAt = null))
    }

    fun edit(caller: Caller, details: EntryDetails): RunningTimer {
        val resolved = entries.resolve(caller.id, details)
        val current = current(caller.id)
        return save(
            caller,
            current.copy(
                description = resolved.description,
                projectId = resolved.projectId,
                taskId = resolved.taskId,
            ),
        )
    }

    fun stop(caller: Caller): TimeEntry? {
        val current = running(caller.id) ?: return null
        val entry = finish(caller, current)
        discard(caller.id)
        return entry
    }

    /** Stops the timer when it tracks one of [taskIds]. */
    fun stopFor(caller: Caller, taskIds: List<UUID>) {
        if (running(caller.id)?.taskId?.let { it in taskIds } == true) stop(caller)
    }

    fun discard(user: Long) {
        jdbc.sql("DELETE FROM running_timer WHERE user_id = :user").param("user", user).update()
    }

    fun restore(caller: Caller, timer: RunningTimer): RunningTimer {
        if (running(caller.id) != null) invalid("Another timer is running, so this can't be undone.")
        timer.taskId?.let { tasks.get(caller.id, it) }
        timer.projectId?.let { projects.get(caller.id, it) }
        return save(caller, timer)
    }

    private fun current(user: Long): RunningTimer = running(user) ?: invalid("No timer is running.")

    private fun finish(caller: Caller, running: RunningTimer): TimeEntry? {
        if (running.pausedAt != null) return null
        val now = caller.now()
        val startedAt = maxOf(running.startedAt, now - TimeRules.DAY_SECONDS)
        if (now - startedAt < 1) return null
        val input = EntryInput(running.description, running.projectId, running.taskId, startedAt, now)
        return entries.create(caller, input)
    }

    private fun save(caller: Caller, timer: RunningTimer): RunningTimer {
        jdbc
            .sql(
                """
                INSERT INTO running_timer (id, user_id, description, project_id, task_id, started_at, paused_at,
                                           banked_seconds)
                VALUES (:id, :user, :description, :project, :task, :startedAt, :pausedAt, :banked)
                ON CONFLICT (user_id) DO UPDATE SET
                  description = EXCLUDED.description, project_id = EXCLUDED.project_id, task_id = EXCLUDED.task_id,
                  started_at = EXCLUDED.started_at, paused_at = EXCLUDED.paused_at,
                  banked_seconds = EXCLUDED.banked_seconds
                """,
            ).param("id", NaturalIds.runningTimer(caller.scopeId))
            .param("user", caller.id)
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
