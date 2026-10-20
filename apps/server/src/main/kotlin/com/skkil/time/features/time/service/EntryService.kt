package com.skkil.time.features.time.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.tasks.repository.TaskRepository
import com.skkil.time.features.time.domain.EntryDetails
import com.skkil.time.features.time.domain.EntryInput
import com.skkil.time.features.time.domain.TimeEntry
import com.skkil.time.features.time.domain.TimeRules
import com.skkil.time.features.time.domain.TrackedEntry
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

/** Tracked time. A linked task decides the entry's project. */
@Service
@Transactional
class EntryService(
    private val jdbc: JdbcClient,
    private val tasks: TaskRepository,
    private val projects: ProjectService,
) {
    /** Every entry overlapping the days from [from] up to [to]. */
    @Transactional(readOnly = true)
    fun list(caller: Caller, from: LocalDate, to: LocalDate): List<TimeEntry> =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND started_at < :to AND ended_at > :from ORDER BY started_at DESC")
            .param("user", caller.id)
            .param("from", caller.startOf(from))
            .param("to", caller.startOf(to))
            .query(mapper)
            .list()

    /** The whole history of a task and everything nested under it. */
    @Transactional(readOnly = true)
    fun listForTask(user: Long, taskId: UUID): List<TrackedEntry> =
        jdbc
            .sql(
                """
                WITH RECURSIVE down(id) AS (
                  SELECT CAST(:task AS UUID)
                  UNION ALL
                  SELECT child.id FROM task child JOIN down ON child.parent_id = down.id
                )
                $SELECT_TRACKED
                WHERE e.user_id = :user AND e.task_id IN (SELECT id FROM down)
                ORDER BY e.started_at DESC
                """,
            ).param("user", user)
            .param("task", taskId)
            .query(trackedMapper)
            .list()

    /** The whole history of a project and its sub-projects, following a linked task's current project. */
    @Transactional(readOnly = true)
    fun listForProject(user: Long, projectId: UUID): List<TrackedEntry> =
        jdbc
            .sql(
                """
                WITH RECURSIVE down(id) AS (
                  SELECT CAST(:project AS UUID)
                  UNION ALL
                  SELECT child.id FROM project child JOIN down ON child.parent_id = down.id
                )
                $SELECT_TRACKED
                WHERE e.user_id = :user
                  AND CASE WHEN e.task_id IS NULL THEN e.project_id ELSE t.project_id END IN (SELECT id FROM down)
                ORDER BY e.started_at DESC
                """,
            ).param("user", user)
            .param("project", projectId)
            .query(trackedMapper)
            .list()

    fun create(caller: Caller, input: EntryInput, id: UUID? = null): TimeEntry {
        validateSpan(caller.now(), input.startedAt, input.endedAt)
        val details = resolve(caller.id, input.details())
        val id = id ?: caller.nextId()
        jdbc
            .sql(
                """
                INSERT INTO time_entry (id, user_id, description, project_id, task_id, started_at, ended_at)
                VALUES (:id, :user, :description, :project, :task, :startedAt, :endedAt)
                """,
            ).param("id", id)
            .param("user", caller.id)
            .details(details)
            .param("startedAt", input.startedAt)
            .param("endedAt", input.endedAt)
            .update()
        return get(caller.id, id)
    }

    fun update(caller: Caller, id: UUID, input: EntryInput): TimeEntry {
        val user = caller.id
        validateSpan(caller.now(), input.startedAt, input.endedAt)
        val details = resolve(user, input.details())
        val rows =
            jdbc
                .sql(
                    """
                    UPDATE time_entry
                    SET description = :description, project_id = :project, task_id = :task,
                        started_at = :startedAt, ended_at = :endedAt
                    WHERE user_id = :user AND id = :id
                    """,
                ).param("user", user)
                .param("id", id)
                .details(details)
                .param("startedAt", input.startedAt)
                .param("endedAt", input.endedAt)
                .update()
        ensureChanged(rows, "Time entry")
        return get(user, id)
    }

    fun delete(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM time_entry WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Time entry")
    }

    /** Validates [details], taking the project from the linked task when there is one. */
    fun resolve(user: Long, details: EntryDetails): EntryDetails {
        val description = optionalText(details.description, "Description", 500)
        val projectId = if (details.taskId != null) tasks.get(user, details.taskId).projectId else details.projectId
        projectId?.let { projects.get(user, it) }
        return EntryDetails(description, projectId, details.taskId)
    }

    private fun get(user: Long, id: UUID): TimeEntry =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Time entry")

    private fun validateSpan(now: Long, startedAt: Long, endedAt: Long) {
        val length = endedAt - startedAt
        ensure(length >= 0) { "An entry must end after it starts." }
        ensure(length <= TimeRules.DAY_SECONDS) { "An entry can't be longer than 24 hours." }
        ensure(endedAt <= now + TimeRules.FUTURE_TOLERANCE_SECONDS) { "An entry can't end in the future." }
    }

    private fun JdbcClient.StatementSpec.details(details: EntryDetails) =
        param("description", details.description).param("project", details.projectId).param("task", details.taskId)

    private companion object {
        const val SELECT = "SELECT id, description, project_id, task_id, started_at, ended_at FROM time_entry"
        const val SELECT_TRACKED = """
            SELECT e.id, e.description, e.project_id, e.task_id, e.started_at, e.ended_at,
                   t.title, t.completed_at IS NOT NULL AS task_completed
            FROM time_entry e
            LEFT JOIN task t ON t.id = e.task_id
        """
        val mapper =
            RowMapper { rs, _ ->
                TimeEntry(
                    rs.uuid("id"),
                    rs.getString("description"),
                    rs.uuidOrNull("project_id"),
                    rs.uuidOrNull("task_id"),
                    rs.getLong("started_at"),
                    rs.getLong("ended_at"),
                )
            }
        val trackedMapper =
            RowMapper { rs, _ ->
                TrackedEntry(
                    rs.uuid("id"),
                    rs.getString("description"),
                    rs.uuidOrNull("project_id"),
                    rs.uuidOrNull("task_id"),
                    rs.getLong("started_at"),
                    rs.getLong("ended_at"),
                    rs.getString("title"),
                    rs.getBoolean("task_completed"),
                )
            }
    }
}
