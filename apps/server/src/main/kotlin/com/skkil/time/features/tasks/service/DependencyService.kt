package com.skkil.time.features.tasks.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.invalid
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.repository.TaskRepository
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Tasks waiting on other tasks. "Blocked" is derived from the open blockers, never stored. */
@Service
@Transactional
class DependencyService(private val jdbc: JdbcClient, private val tasks: TaskRepository) {
    fun add(caller: Caller, taskId: UUID, blockedById: UUID): Task {
        val user = caller.id
        ensure(taskId != blockedById) { "A task can't wait on itself." }
        tasks.get(user, taskId)
        val blocker = tasks.get(user, blockedById)
        ensure(blocker.recurrence == null) { "A repeating task never finishes, so nothing can wait on it." }
        ensure(blocker.kind != "event") { "Events don't finish, so nothing can wait on them." }
        if (wouldLoop(taskId, blockedById)) invalid("“${blocker.title}” already waits on this task.")
        jdbc
            .sql(
                "INSERT INTO task_dependency (id, task_id, blocked_by_id) VALUES (:id, :task, :blocker) " +
                    "ON CONFLICT (task_id, blocked_by_id) DO NOTHING",
            ).param("id", NaturalIds.taskDependency(caller.scopeId, taskId, blockedById))
            .param("task", taskId)
            .param("blocker", blockedById)
            .update()
        return tasks.get(user, taskId)
    }

    fun remove(user: Long, taskId: UUID, blockedById: UUID): Task {
        tasks.get(user, taskId)
        jdbc
            .sql("DELETE FROM task_dependency WHERE task_id = :task AND blocked_by_id = :blocker")
            .param("task", taskId)
            .param("blocker", blockedById)
            .update()
        return tasks.get(user, taskId)
    }

    private fun wouldLoop(taskId: UUID, blockedById: UUID): Boolean =
        jdbc
            .sql(
                """
                WITH RECURSIVE up(id) AS (
                  SELECT CAST(:blocker AS UUID)
                  UNION
                  SELECT d.blocked_by_id FROM task_dependency d JOIN up ON d.task_id = up.id
                )
                SELECT EXISTS(SELECT 1 FROM up WHERE id = :task)
                """,
            ).param("blocker", blockedById)
            .param("task", taskId)
            .query(Boolean::class.java)
            .single()
}
