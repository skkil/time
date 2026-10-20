package com.skkil.time.features.workflow.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.recurrence.domain.Recurrence
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.service.TaskService
import com.skkil.time.features.workflow.domain.EventOccurrence
import com.skkil.time.features.workflow.domain.Milestone
import com.skkil.time.features.workflow.domain.TypeTime
import com.skkil.time.features.workflow.domain.WorkflowRules
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

/** A task's type, status, milestone and event details, and the events and time they add up to. */
@Service
@Transactional
class TaskWorkflowService(
    private val jdbc: JdbcClient,
    private val tasks: TaskService,
    private val workflow: WorkflowService,
    private val sync: WorkflowSync,
) {
    fun setType(caller: Caller, id: UUID, typeId: UUID?): Task {
        val user = caller.id
        val task = tasks.get(user, id)
        val type =
            typeId?.let {
                val type = workflow.getType(user, it)
                ensure(type.projectId == task.projectId) { "That type belongs to another project." }
                ensure(type.kind != "event" || task.dueTime != null) {
                    "Give it a date and time first. Events happen at a time."
                }
                type
            }
        jdbc
            .sql(
                """
                UPDATE task SET type_id = CAST(:type AS UUID),
                  estimate_minutes = COALESCE(estimate_minutes, CAST(:minutes AS INTEGER)),
                  completed_at = CASE WHEN :event THEN NULL ELSE completed_at END
                WHERE user_id = :user AND id = :id
                """,
            ).param("type", typeId)
            .param("minutes", type?.defaultMinutes)
            .param("event", type?.kind == "event")
            .param("user", user)
            .param("id", id)
            .update()
        val hasChildren =
            jdbc
                .sql("SELECT EXISTS (SELECT 1 FROM task WHERE parent_id = :id)")
                .param("id", id)
                .query(Boolean::class.java)
                .single()
        if (type != null && !hasChildren) {
            type.checklist
                .lines()
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .forEachIndexed { position, line ->
                    jdbc
                        .sql(
                            """
                            INSERT INTO task (id, user_id, title, project_id, section_id, parent_id, position,
                                              created_at)
                            VALUES (:id, :user, :title, :project, :section, :parent, :position, :now)
                            """,
                        ).param("id", caller.nextId())
                        .param("user", user)
                        .param("title", line)
                        .param("project", task.projectId)
                        .param("section", task.sectionId)
                        .param("parent", id)
                        .param("position", position)
                        .param("now", caller.now())
                        .update()
                }
            sync.reconcile(user)
        }
        return tasks.get(user, id)
    }

    fun setStatus(caller: Caller, id: UUID, statusId: UUID): Task {
        val user = caller.id
        val task = tasks.get(user, id)
        val status = workflow.getStatus(user, statusId)
        ensure(status.projectId == task.projectId) { "That status belongs to another project." }
        ensure(task.kind != "event") { "Events happen at a time; they don't have a status." }
        val closing = status.category in listOf("done", "dropped")
        if (closing && task.completedAt == null && task.recurrence != null) return tasks.setCompleted(caller, id, true)
        val now = caller.now()
        jdbc
            .sql("UPDATE task SET status_id = :status, status_changed_at = :now WHERE user_id = :user AND id = :id")
            .param("status", statusId)
            .param("now", now)
            .param("user", user)
            .param("id", id)
            .update()
        if (closing && task.completedAt == null) {
            jdbc
                .sql(
                    """
                    UPDATE task SET completed_at = :now
                    WHERE completed_at IS NULL AND id IN (
                      WITH RECURSIVE down(id) AS (
                        SELECT CAST(:id AS UUID) UNION ALL SELECT t.id FROM task t JOIN down ON t.parent_id = down.id)
                      SELECT id FROM down)
                    """,
                ).param("now", now)
                .param("id", id)
                .update()
            tasks.stopTimerWithin(caller, id)
        } else if (!closing) {
            jdbc
                .sql("UPDATE task SET completed_at = NULL WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        }
        return tasks.get(user, id)
    }

    fun setMilestone(user: Long, id: UUID, milestoneId: UUID?): Task {
        val task = tasks.get(user, id)
        milestoneId?.let {
            val project =
                jdbc
                    .sql("SELECT project_id FROM milestone WHERE user_id = :user AND id = :id")
                    .param("user", user)
                    .param("id", it)
                    .query { rs, _ -> rs.uuid("project_id") }
                    .optional()
                    .orElse(null)
                    .orNotFound("Milestone")
            ensure(project == task.projectId) { "That milestone belongs to another project." }
        }
        jdbc
            .sql("UPDATE task SET milestone_id = CAST(:milestone AS UUID) WHERE user_id = :user AND id = :id")
            .param("milestone", milestoneId)
            .param("user", user)
            .param("id", id)
            .update()
        return tasks.get(user, id)
    }

    fun setEventDetails(user: Long, id: UUID, location: String, countsAsTime: Boolean): Task {
        val text = optionalText(location, "Location", 300)
        val rows =
            jdbc
                .sql(
                    "UPDATE task SET location = :location, counts_as_time = :counts WHERE user_id = :user AND id = :id",
                )
                .param("location", text)
                .param("counts", countsAsTime)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Task")
        return tasks.get(user, id)
    }

    /** Every occurrence of an open event in `[from, to)`, with repeats expanded. */
    @Transactional(readOnly = true)
    fun occurrences(caller: Caller, from: LocalDate, to: LocalDate): List<EventOccurrence> {
        data class Row(
            val taskId: UUID,
            val title: String,
            val projectId: UUID?,
            val typeId: UUID?,
            val due: LocalDate,
            val minute: Long,
            val length: Long,
            val recurrence: String?,
            val location: String,
            val counts: Boolean,
        )
        val rows =
            jdbc
                .sql(
                    """
                    SELECT t.id, t.title, t.project_id, t.type_id, t.due_date, t.due_time,
                      COALESCE(t.estimate_minutes, ty.default_minutes, :defaultMinutes) AS length, t.recurrence,
                      t.location, t.counts_as_time
                    FROM task t
                    JOIN item_type ty ON ty.id = t.type_id AND ty.kind = 'event'
                    LEFT JOIN project p ON p.id = t.project_id
                    WHERE t.user_id = :user AND t.due_date IS NOT NULL AND t.due_time IS NOT NULL
                      AND t.due_date < :to AND t.completed_at IS NULL AND (p.id IS NULL OR NOT p.archived)
                    """,
                ).param("defaultMinutes", WorkflowRules.DEFAULT_EVENT_MINUTES)
                .param("user", caller.id)
                .param("to", to)
                .query { rs, _ ->
                    Row(
                        rs.uuid("id"),
                        rs.getString("title"),
                        rs.uuidOrNull("project_id"),
                        rs.uuidOrNull("type_id"),
                        rs.getObject("due_date", LocalDate::class.java),
                        rs.getLong("due_time"),
                        rs.getLong("length"),
                        rs.getString("recurrence"),
                        rs.getString("location"),
                        rs.getBoolean("counts_as_time"),
                    )
                }.list()
        return rows
            .flatMap { row ->
                val repeat = row.recurrence?.let(Recurrence::parse)
                generateSequence(row.due) { day -> repeat?.following(day) }
                    .takeWhile { it < to }
                    .filter { it >= from }
                    .map { day ->
                        val startAt = caller.startOf(day) + row.minute * 60
                        EventOccurrence(
                            row.taskId,
                            row.title,
                            row.projectId,
                            row.typeId,
                            startAt,
                            startAt + row.length * 60,
                            row.location,
                            row.counts,
                        )
                    }.toList()
            }.sortedBy { it.startAt }
    }

    /** Tracked time per type name in `[from, to)`, plus finished events that count as time. */
    @Transactional(readOnly = true)
    fun timeByType(caller: Caller, from: LocalDate, to: LocalDate): List<TypeTime> {
        val totals = linkedMapOf<String, TypeTime>()

        fun add(name: String, icon: String, seconds: Long) {
            totals[name] =
                totals[name]?.let { it.copy(seconds = it.seconds + seconds) } ?: TypeTime(name, icon, seconds)
        }
        jdbc
            .sql(
                """
                SELECT ty.name, ty.icon, SUM(e.ended_at - e.started_at)::BIGINT AS seconds
                FROM time_entry e
                JOIN task t ON t.id = e.task_id
                JOIN item_type ty ON ty.id = t.type_id
                WHERE e.user_id = :user AND e.started_at >= :from AND e.started_at < :to
                GROUP BY ty.name, ty.icon
                ORDER BY ty.name, ty.icon
                """,
            ).param("user", caller.id)
            .param("from", caller.startOf(from))
            .param("to", caller.startOf(to))
            .query { rs, _ -> Triple(rs.getString("name"), rs.getString("icon"), rs.getLong("seconds")) }
            .list()
            .forEach { (name, icon, seconds) -> add(name, icon, seconds) }
        val now = caller.now()
        for (event in occurrences(caller, from, to)) {
            if (!event.countsAsTime || event.endAt > now) continue
            event.typeId?.let { workflow.getType(caller.id, it) }?.let {
                add(
                    it.name,
                    it.icon,
                    event.endAt - event.startAt,
                )
            }
        }
        return totals.values.sortedByDescending { it.seconds }
    }
}
