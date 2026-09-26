package com.skkil.time.features.tasks

import com.skkil.time.common.ensure
import com.skkil.time.common.invalid
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** Tasks waiting on other tasks. "Blocked" is derived from the open blockers, never stored. */
@Service
@Transactional
class DependencyService(private val jdbc: JdbcClient, private val tasks: TaskRepository) {
    fun add(user: Long, taskId: Long, blockedById: Long): Task {
        ensure(taskId != blockedById) { "A task can't wait on itself." }
        tasks.get(user, taskId)
        val blocker = tasks.get(user, blockedById)
        ensure(blocker.recurrence == null) { "A repeating task never finishes, so nothing can wait on it." }
        ensure(blocker.kind != "event") { "Events don't finish, so nothing can wait on them." }
        if (wouldLoop(taskId, blockedById)) invalid("“${blocker.title}” already waits on this task.")
        jdbc
            .sql("INSERT INTO task_dependency (task_id, blocked_by_id) VALUES (:task, :blocker) ON CONFLICT DO NOTHING")
            .param("task", taskId)
            .param("blocker", blockedById)
            .update()
        return tasks.get(user, taskId)
    }

    fun remove(user: Long, taskId: Long, blockedById: Long): Task {
        tasks.get(user, taskId)
        jdbc
            .sql("DELETE FROM task_dependency WHERE task_id = :task AND blocked_by_id = :blocker")
            .param("task", taskId)
            .param("blocker", blockedById)
            .update()
        return tasks.get(user, taskId)
    }

    private fun wouldLoop(taskId: Long, blockedById: Long): Boolean =
        jdbc
            .sql(
                """
                WITH RECURSIVE up(id) AS (
                  SELECT CAST(:blocker AS BIGINT)
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
