package com.skkil.time.features.tasks.repository

import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.dateOrNull
import com.skkil.time.common.persistence.intOrNull
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.persistence.uuids
import com.skkil.time.features.tasks.domain.Container
import com.skkil.time.features.tasks.domain.Task
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
class TaskRepository(private val jdbc: JdbcClient) {
    fun get(user: Long, id: UUID): Task =
        jdbc
            .sql("$SELECT WHERE t.user_id = :user AND t.id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Task")

    /** Open tasks and those closed since [since], leaving out archived projects. */
    fun list(user: Long, since: Long): List<Task> =
        jdbc
            .sql(
                """
                $SELECT
                LEFT JOIN project p ON p.id = t.project_id
                WHERE t.user_id = :user AND (t.completed_at IS NULL OR t.completed_at >= :since)
                  AND (p.id IS NULL OR NOT p.archived)
                ORDER BY t.position, t.id
                """,
            ).param("user", user)
            .param("since", since)
            .query(mapper)
            .list()

    /** Every task nested under [id], at any depth. */
    fun descendants(user: Long, id: UUID): List<UUID> =
        jdbc
            .sql(
                """
                WITH RECURSIVE down(id) AS (
                  SELECT id FROM task WHERE parent_id = :id AND user_id = :user
                  UNION ALL
                  SELECT t.id FROM task t JOIN down ON t.parent_id = down.id
                )
                SELECT id FROM down
                """,
            ).param("user", user)
            .param("id", id)
            .query { rs, _ -> rs.uuid("id") }
            .list()

    fun siblings(user: Long, container: Container, except: UUID): List<UUID> =
        jdbc
            .sql(
                """
                SELECT id FROM task
                WHERE user_id = :user AND project_id IS NOT DISTINCT FROM :project
                  AND section_id IS NOT DISTINCT FROM :section AND parent_id IS NOT DISTINCT FROM :parent
                  AND id <> :except AND completed_at IS NULL
                ORDER BY position, id
                """,
            ).param("user", user)
            .param("project", container.projectId)
            .param("section", container.sectionId)
            .param("parent", container.parentId)
            .param("except", except)
            .query { rs, _ -> rs.uuid("id") }
            .list()

    private companion object {
        const val SELECT = """
            SELECT t.id, t.title, t.notes, t.project_id, t.section_id, t.parent_id,
              t.priority, t.due_date, t.due_time, t.deadline, t.recurrence, t.estimate_minutes,
              t.position, t.completed_at, t.created_at,
              (SELECT COALESCE(SUM(e.ended_at - e.started_at), 0)::BIGINT FROM time_entry e WHERE e.task_id = t.id)
                AS tracked_seconds,
              t.outcome_id, t.rollover_count, t.someday, t.next_step, t.must_on,
              t.type_id, t.status_id, t.milestone_id, t.location, t.counts_as_time, t.status_changed_at,
              COALESCE((SELECT ty.kind FROM item_type ty WHERE ty.id = t.type_id), 'task') AS kind,
              (SELECT st.category FROM item_status st WHERE st.id = t.status_id) AS status_category,
              ARRAY(SELECT d.blocked_by_id FROM task_dependency d WHERE d.task_id = t.id ORDER BY d.blocked_by_id)
                AS blocked_by,
              ARRAY(SELECT d.blocked_by_id FROM task_dependency d JOIN task b ON b.id = d.blocked_by_id
                    WHERE d.task_id = t.id AND b.completed_at IS NULL ORDER BY d.blocked_by_id) AS waiting_on,
              t.phase_id
            FROM task t"""

        val mapper =
            RowMapper { rs, _ ->
                Task(
                    id = rs.uuid("id"),
                    title = rs.getString("title"),
                    notes = rs.getString("notes"),
                    projectId = rs.uuidOrNull("project_id"),
                    sectionId = rs.uuidOrNull("section_id"),
                    parentId = rs.uuidOrNull("parent_id"),
                    priority = rs.getInt("priority"),
                    dueDate = rs.dateOrNull("due_date"),
                    dueTime = rs.intOrNull("due_time"),
                    deadline = rs.dateOrNull("deadline"),
                    recurrence = rs.getString("recurrence"),
                    estimateMinutes = rs.intOrNull("estimate_minutes"),
                    position = rs.getInt("position"),
                    completedAt = rs.longOrNull("completed_at"),
                    createdAt = rs.getLong("created_at"),
                    trackedSeconds = rs.getLong("tracked_seconds"),
                    outcomeId = rs.uuidOrNull("outcome_id"),
                    rolloverCount = rs.getInt("rollover_count"),
                    someday = rs.getBoolean("someday"),
                    nextStep = rs.getString("next_step"),
                    mustOn = rs.dateOrNull("must_on"),
                    typeId = rs.uuidOrNull("type_id"),
                    statusId = rs.uuidOrNull("status_id"),
                    milestoneId = rs.uuidOrNull("milestone_id"),
                    location = rs.getString("location"),
                    countsAsTime = rs.getBoolean("counts_as_time"),
                    statusChangedAt = rs.longOrNull("status_changed_at"),
                    kind = rs.getString("kind"),
                    statusCategory = rs.getString("status_category"),
                    blockedBy = rs.uuids("blocked_by"),
                    waitingOn = rs.uuids("waiting_on"),
                    phaseId = rs.uuidOrNull("phase_id"),
                )
            }
    }
}
