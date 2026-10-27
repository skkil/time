package com.skkil.time.features.records.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.records.domain.RecordPhase
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.domain.TaskInput
import com.skkil.time.features.tasks.service.TaskService
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Records are long-lived items whose status is their current phase. Their sub-tasks carry a phase, and each phase
 * keeps its own note.
 */
@Service
@Transactional
class RecordService(private val jdbc: JdbcClient, private val tasks: TaskService) {
    @Transactional(readOnly = true)
    fun phases(user: Long, taskId: UUID): List<RecordPhase> =
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
            .query { rs, _ -> RecordPhase(rs.uuid("status_id"), rs.getString("notes")) }
            .list()

    fun setNotes(caller: Caller, taskId: UUID, statusId: UUID, notes: String) {
        val user = caller.id
        checkPhase(user, record(user, taskId), statusId)
        val text = optionalText(notes, "Phase notes", 20_000)
        val sql =
            if (text.isEmpty()) {
                "DELETE FROM record_phase WHERE task_id = :task AND status_id = :status"
            } else {
                """
                INSERT INTO record_phase (id, task_id, status_id, notes) VALUES (:id, :task, :status, :notes)
                ON CONFLICT (task_id, status_id) DO UPDATE SET notes = excluded.notes
                """
            }
        jdbc.sql(
            sql,
        ).params(
            mapOf(
                "id" to NaturalIds.recordPhase(caller.scopeId, taskId, statusId),
                "task" to taskId,
                "status" to statusId,
                "notes" to text,
            ),
        ).update()
    }

    fun setPhase(user: Long, id: UUID, phaseId: UUID?): Task {
        val task = tasks.get(user, id)
        if (phaseId != null) {
            val parent = task.parentId ?: invalid("Only tasks inside a record have a phase.")
            checkPhase(user, record(user, parent), phaseId)
        }
        jdbc
            .sql("UPDATE task SET phase_id = CAST(:phase AS UUID) WHERE user_id = :user AND id = :id")
            .param("phase", phaseId)
            .param("user", user)
            .param("id", id)
            .update()
        return tasks.get(user, id)
    }

    fun createTask(caller: Caller, recordId: UUID, phaseId: UUID, title: String, id: UUID? = null): Task {
        val parent = record(caller.id, recordId)
        checkPhase(caller.id, parent, phaseId)
        val task =
            tasks.create(
                caller,
                TaskInput(title, "", parent.projectId, parent.sectionId, recordId, 4, null, null, null, null, null),
                id,
            )
        return setPhase(caller.id, task.id, phaseId)
    }

    private fun record(user: Long, id: UUID): Task {
        val task = tasks.get(user, id)
        ensure(task.kind == "record") { "Only records have phases." }
        return task
    }

    private fun checkPhase(user: Long, record: Task, statusId: UUID) {
        val project =
            jdbc
                .sql("SELECT project_id FROM item_status WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", statusId)
                .query { rs, _ -> rs.uuid("project_id") }
                .optional()
                .orElse(null)
                .orNotFound("Phase")
        ensure(project == record.projectId) { "That phase belongs to another project." }
    }
}
