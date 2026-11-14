package com.skkil.time.features.tasks.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.notFound
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.recurrence.domain.Recurrence
import com.skkil.time.features.sections.service.SectionService
import com.skkil.time.features.tasks.domain.Container
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.domain.TaskInput
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.tasks.domain.TaskRules
import com.skkil.time.features.tasks.repository.TaskRepository
import com.skkil.time.features.time.service.TimerService
import com.skkil.time.features.workflow.service.WorkflowSync
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.UUID

/**
 * Todoist-shaped tasks. Sub-tasks nest to any depth and follow their parent's project and section; completing,
 * moving or deleting reaches every level. Completing a repeating task moves its date forward instead.
 */
@Service
@Transactional
class TaskService(
    private val jdbc: JdbcClient,
    private val tasks: TaskRepository,
    private val projects: ProjectService,
    private val sections: SectionService,
    private val workflow: WorkflowSync,
    private val timer: TimerService,
) {
    private data class Valid(val title: String, val notes: String, val container: Container, val recurrence: String?)

    @Transactional(readOnly = true)
    fun get(user: Long, id: UUID): Task = tasks.get(user, id)

    @Transactional(readOnly = true)
    fun list(caller: Caller): List<Task> =
        tasks.list(caller.id, caller.now() - TaskRules.COMPLETED_HISTORY_DAYS * TaskRules.DAY_SECONDS)

    fun create(caller: Caller, input: TaskInput, id: UUID? = null): Task {
        val first = onFirstOccurrence(input, caller.today())
        val valid = validate(caller.id, null, first)
        val id = id ?: caller.nextId()
        jdbc
            .sql(
                """
                INSERT INTO task (id, user_id, title, notes, priority, due_date, due_time, deadline, recurrence,
                                  estimate_minutes, created_at)
                VALUES (:id, :user, :title, :notes, :priority, :dueDate, :dueTime, :deadline, :recurrence,
                        :estimate, :now)
                """,
            ).param("id", id)
            .param("user", caller.id)
            .param("title", valid.title)
            .param("notes", valid.notes)
            .param("priority", first.priority)
            .param("dueDate", first.dueDate)
            .param("dueTime", first.dueTime)
            .param("deadline", first.deadline)
            .param("recurrence", valid.recurrence)
            .param("estimate", first.estimateMinutes)
            .param("now", caller.now())
            .update()
        place(caller.id, id, valid.container, null)
        workflow.reconcile(caller.id)
        jdbc
            .sql(
                """
                UPDATE task SET outcome_id = (SELECT p.outcome_id FROM task p WHERE p.id = task.parent_id)
                WHERE user_id = :user AND id = :id AND parent_id IS NOT NULL
                """,
            ).param("user", caller.id)
            .param("id", id)
            .update()
        return get(caller.id, id)
    }

    fun update(user: Long, id: UUID, input: TaskInput): Task {
        val current = get(user, id)
        val valid = validate(user, id, input)
        ensure(current.kind != "event" || (input.dueDate != null && input.dueTime != null)) {
            "Events need a date and a time."
        }
        jdbc
            .sql(
                """
                UPDATE task SET title = :title, notes = :notes, priority = :priority, due_date = :dueDate,
                  due_time = :dueTime, deadline = :deadline, recurrence = :recurrence, estimate_minutes = :estimate,
                  due_until = CASE WHEN due_date IS NOT DISTINCT FROM CAST(:dueDate AS DATE)
                    AND CAST(:dueTime AS INTEGER) IS NULL AND CAST(:recurrence AS TEXT) IS NULL
                    THEN due_until END
                WHERE user_id = :user AND id = :id
                """,
            ).param("title", valid.title)
            .param("notes", valid.notes)
            .param("priority", input.priority)
            .param("dueDate", input.dueDate)
            .param("dueTime", input.dueTime)
            .param("deadline", input.deadline)
            .param("recurrence", valid.recurrence)
            .param("estimate", input.estimateMinutes)
            .param("user", user)
            .param("id", id)
            .update()
        if (Container(current.projectId, current.sectionId, current.parentId) != valid.container) {
            place(user, id, valid.container, null)
            workflow.reconcile(user)
        }
        return get(user, id)
    }

    fun move(user: Long, id: UUID, placement: TaskPlacement): Task {
        get(user, id)
        val container = resolveContainer(user, id, placement.projectId, placement.sectionId, placement.parentId)
        place(user, id, container, placement.before)
        workflow.reconcile(user)
        return get(user, id)
    }

    fun reschedule(caller: Caller, ids: List<UUID>, dueDate: LocalDate?) {
        for (id in ids) {
            val rows =
                jdbc
                    .sql(
                        """
                        UPDATE task SET
                          due_date = CAST(:due AS DATE),
                          due_until = NULL,
                          due_time = CASE WHEN CAST(:due AS DATE) IS NULL THEN NULL ELSE due_time END,
                          recurrence = CASE WHEN CAST(:due AS DATE) IS NULL THEN NULL ELSE recurrence END,
                          must_on = CASE WHEN must_on = CAST(:due AS DATE) THEN must_on ELSE NULL END
                        WHERE user_id = :user AND id = :id
                        """,
                    ).param("due", dueDate)
                    .param("user", caller.id)
                    .param("id", id)
                    .update()
            ensureChanged(rows, "Task")
        }
    }

    fun setCompleted(caller: Caller, id: UUID, completed: Boolean): Task {
        val user = caller.id
        val now = caller.now()
        val task = get(user, id)
        ensure(task.kind != "event") { "Events happen at a time; they can't be checked off." }
        val repeat = task.recurrence?.let(Recurrence::parse)
        val next = if (completed && task.dueDate != null) repeat?.nextAfter(task.dueDate, caller.today()) else null
        if (next != null) {
            jdbc
                .sql("UPDATE task SET due_date = :due WHERE user_id = :user AND id = :id")
                .param("due", next)
                .param("user", user)
                .param("id", id)
                .update()
            stopTimerWithin(caller, id)
            return get(user, id)
        }
        val completedAt = now.takeIf { completed }
        jdbc
            .sql("UPDATE task SET completed_at = CAST(:at AS BIGINT) WHERE user_id = :user AND id = :id")
            .param("at", completedAt)
            .param("user", user)
            .param("id", id)
            .update()
        workflow.statusForCompletion(user, id, completed, now)
        if (completed) {
            for (child in tasks.descendants(user, id)) {
                jdbc
                    .sql("UPDATE task SET completed_at = :at WHERE id = :id AND completed_at IS NULL")
                    .param("at", now)
                    .param("id", child)
                    .update()
                workflow.statusForCompletion(user, child, true, now)
            }
            stopTimerWithin(caller, id)
        }
        return get(user, id)
    }

    fun stopTimerWithin(caller: Caller, id: UUID) = timer.stopFor(caller, tasks.descendants(caller.id, id) + id)

    fun setOutcome(user: Long, id: UUID, outcomeId: UUID?): Task {
        get(user, id)
        outcomeId?.let { ensureOutcome(user, it) }
        jdbc
            .sql("UPDATE task SET outcome_id = CAST(:outcome AS UUID) WHERE user_id = :user AND id IN (:ids)")
            .param("outcome", outcomeId)
            .param("user", user)
            .param("ids", listOf(id) + tasks.descendants(user, id))
            .update()
        return get(user, id)
    }

    fun setMust(user: Long, id: UUID, mustOn: LocalDate?): Task {
        val rows =
            jdbc
                .sql(
                    """
                    UPDATE task SET must_on = CAST(:must AS DATE),
                      due_date = CASE WHEN CAST(:must AS DATE) IS NULL OR due_date <= CAST(:must AS DATE)
                                 THEN due_date ELSE CAST(:must AS DATE) END
                    WHERE user_id = :user AND id = :id
                    """,
                ).param("must", mustOn)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Task")
        return get(user, id)
    }

    fun setNextStep(user: Long, id: UUID, nextStep: String): Task {
        val text = optionalText(nextStep, "Next step", 500)
        val rows =
            jdbc
                .sql("UPDATE task SET next_step = :text WHERE user_id = :user AND id = :id")
                .param("text", text)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Task")
        return get(user, id)
    }

    fun deleteMany(user: Long, ids: List<UUID>) {
        if (ids.isEmpty()) return
        jdbc
            .sql("DELETE FROM task WHERE user_id = :user AND id IN (:ids)")
            .param("user", user)
            .param("ids", ids)
            .update()
    }

    fun delete(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM task WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Task")
    }

    private fun ensureOutcome(user: Long, id: UUID) {
        val exists =
            jdbc
                .sql("SELECT EXISTS(SELECT 1 FROM outcome WHERE user_id = :user AND id = :id)")
                .param("user", user)
                .param("id", id)
                .query(Boolean::class.java)
                .single()
        if (!exists) notFound("Outcome not found.")
    }

    private fun onFirstOccurrence(input: TaskInput, today: LocalDate): TaskInput {
        val repeat = input.recurrence?.let(Recurrence::parse) ?: return input
        return input.copy(dueDate = repeat.firstDate(input.dueDate, today))
    }

    private fun validate(user: Long, moving: UUID?, input: TaskInput): Valid {
        val title = requiredText(input.title, "Task title", 500)
        val notes = optionalText(input.notes, "Description", 10_000)
        ensure(input.priority in 1..4) { "Priority must be between 1 and 4." }
        input.estimateMinutes?.let {
            ensure(it in 1..TaskRules.MAX_ESTIMATE_MINUTES) { "Duration must be between 1 minute and 24 hours." }
        }
        input.dueTime?.let {
            ensure(input.dueDate != null) { "A time needs a date." }
            ensure(it in 0 until 24 * 60) { "Time must be within the day." }
        }
        val recurrence =
            input.recurrence?.trim()?.takeIf { it.isNotEmpty() }?.let { text ->
                val repeat = Recurrence.parse(text) ?: invalid("Can't repeat “$text”.")
                ensure(input.dueDate != null) { "Repeating tasks need a date." }
                repeat.toString()
            }
        val container = resolveContainer(user, moving, input.projectId, input.sectionId, input.parentId)
        return Valid(title, notes, container, recurrence)
    }

    private fun resolveContainer(
        user: Long,
        moving: UUID?,
        projectId: UUID?,
        sectionId: UUID?,
        parentId: UUID?,
    ): Container {
        if (parentId != null) {
            val parent = get(user, parentId)
            if (moving != null && (parentId == moving || parentId in tasks.descendants(user, moving))) {
                invalid("A task can't become its own sub-task.")
            }
            return Container(parent.projectId, parent.sectionId, parentId)
        }
        projectId?.let { ensure(!projects.get(user, it).archived) { "Can't add tasks to an archived project." } }
        sectionId?.let {
            ensure(sections.get(user, it).projectId == projectId) { "That section belongs to another project." }
        }
        return Container(projectId, sectionId, null)
    }

    private fun place(user: Long, id: UUID, container: Container, before: UUID?) {
        val ids = tasks.siblings(user, container, id).toMutableList()
        ids.add(ids.indexOf(before).takeIf { it >= 0 } ?: ids.size, id)
        ids.forEachIndexed { position, sibling ->
            jdbc
                .sql("UPDATE task SET position = :position WHERE id = :id")
                .param("position", position + 1)
                .param("id", sibling)
                .update()
        }
        jdbc
            .sql(
                """
                UPDATE task SET project_id = :project, section_id = :section, parent_id = :parent
                WHERE user_id = :user AND id = :id
                """,
            ).param("project", container.projectId)
            .param("section", container.sectionId)
            .param("parent", container.parentId)
            .param("user", user)
            .param("id", id)
            .update()
        val descendants = tasks.descendants(user, id)
        if (descendants.isEmpty()) return
        jdbc
            .sql("UPDATE task SET project_id = :project, section_id = :section WHERE user_id = :user AND id IN (:ids)")
            .param("project", container.projectId)
            .param("section", container.sectionId)
            .param("user", user)
            .param("ids", descendants)
            .update()
    }
}
