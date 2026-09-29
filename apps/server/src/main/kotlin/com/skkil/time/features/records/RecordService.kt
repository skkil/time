package com.skkil.time.features.records

import com.skkil.time.common.Caller
import com.skkil.time.common.ensure
import com.skkil.time.common.invalid
import com.skkil.time.common.optionalText
import com.skkil.time.common.orNotFound
import com.skkil.time.features.tasks.Task
import com.skkil.time.features.tasks.TaskInput
import com.skkil.time.features.tasks.TaskService
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class RecordPhase(val statusId: Long, val notes: String)

data class PhaseNotes(val notes: String)

data class TaskPhase(val phaseId: Long?)

data class PhaseTaskInput(val phaseId: Long, val title: String)

/**
 * Records are long-lived items whose status is their current phase. Their sub-tasks carry a phase, and each phase
 * keeps its own note.
 */
@Service
@Transactional
class RecordService(private val jdbc: JdbcClient, private val tasks: TaskService) {
    @Transactional(readOnly = true)
    fun phases(user: Long, taskId: Long): List<RecordPhase> =
        jdbc
            .sql(
                """
                SELECT r.status_id, r.notes FROM record_phase r
                JOIN task t ON t.id = r.task_id
                JOIN item_status s ON s.id = r.status_id
                WHERE t.user_id = :user AND r.task_id = :task
                ORDER BY s.position, s.id
                """,
            ).param("user", user)
            .param("task", taskId)
            .query { rs, _ -> RecordPhase(rs.getLong("status_id"), rs.getString("notes")) }
            .list()

    fun setNotes(user: Long, taskId: Long, statusId: Long, notes: String) {
        checkPhase(user, record(user, taskId), statusId)
        val text = optionalText(notes, "Phase notes", 20_000)
        val sql =
            if (text.isEmpty()) {
                "DELETE FROM record_phase WHERE task_id = :task AND status_id = :status"
            } else {
                """
                INSERT INTO record_phase (task_id, status_id, notes) VALUES (:task, :status, :notes)
                ON CONFLICT (task_id, status_id) DO UPDATE SET notes = excluded.notes
                """
            }
        jdbc.sql(sql).params(mapOf("task" to taskId, "status" to statusId, "notes" to text)).update()
    }

    fun setPhase(user: Long, id: Long, phaseId: Long?): Task {
        val task = tasks.get(user, id)
        if (phaseId != null) {
            val parent = task.parentId ?: invalid("Only tasks inside a record have a phase.")
            checkPhase(user, record(user, parent), phaseId)
        }
        jdbc
            .sql("UPDATE task SET phase_id = CAST(:phase AS BIGINT) WHERE user_id = :user AND id = :id")
            .param("phase", phaseId)
            .param("user", user)
            .param("id", id)
            .update()
        return tasks.get(user, id)
    }

    fun createTask(caller: Caller, recordId: Long, phaseId: Long, title: String): Task {
        val parent = record(caller.id, recordId)
        checkPhase(caller.id, parent, phaseId)
        val task =
            tasks.create(
                caller,
                TaskInput(title, "", parent.projectId, parent.sectionId, recordId, 4, null, null, null, null, null),
            )
        return setPhase(caller.id, task.id, phaseId)
    }

    private fun record(user: Long, id: Long): Task {
        val task = tasks.get(user, id)
        ensure(task.kind == "record") { "Only records have phases." }
        return task
    }

    private fun checkPhase(user: Long, record: Task, statusId: Long) {
        val project =
            jdbc
                .sql("SELECT project_id FROM item_status WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", statusId)
                .query { rs, _ -> rs.getLong("project_id") }
                .optional()
                .orElse(null)
                .orNotFound("Phase")
        ensure(project == record.projectId) { "That phase belongs to another project." }
    }
}
