package com.skkil.time.features.tasks

import java.time.LocalDate

data class Task(
    val id: Long,
    val title: String,
    val notes: String,
    val projectId: Long?,
    val sectionId: Long?,
    val parentId: Long?,
    val priority: Int,
    val dueDate: LocalDate?,
    val dueTime: Int?,
    val deadline: LocalDate?,
    val recurrence: String?,
    val estimateMinutes: Int?,
    val position: Int,
    val completedAt: Long?,
    val createdAt: Long,
    val trackedSeconds: Long,
    val outcomeId: Long?,
    val rolloverCount: Int,
    val someday: Boolean,
    val nextStep: String,
    val mustOn: LocalDate?,
    val typeId: Long?,
    val statusId: Long?,
    val milestoneId: Long?,
    val location: String,
    val countsAsTime: Boolean,
    val statusChangedAt: Long?,
    val kind: String,
    val statusCategory: String?,
    val blockedBy: List<Long>,
    val waitingOn: List<Long>,
    val phaseId: Long?,
)

data class TaskInput(
    val title: String,
    val notes: String,
    val projectId: Long?,
    val sectionId: Long?,
    val parentId: Long?,
    val priority: Int,
    val dueDate: LocalDate?,
    val dueTime: Int?,
    val deadline: LocalDate?,
    val recurrence: String?,
    val estimateMinutes: Int?,
)

data class TaskPlacement(val projectId: Long?, val sectionId: Long?, val parentId: Long?, val before: Long?)

data class TaskIds(val ids: List<Long>)

data class TaskReschedule(val ids: List<Long>, val dueDate: LocalDate?)

data class TasksSomeday(val ids: List<Long>, val someday: Boolean)

data class TaskCompleted(val completed: Boolean)

data class TaskOutcome(val outcomeId: Long?)

data class TaskMust(val mustOn: LocalDate?)

data class TaskNextStep(val nextStep: String)

data class TaskDependency(val blockedById: Long)

data class Container(val projectId: Long?, val sectionId: Long?, val parentId: Long?)

object TaskRules {
    const val MAX_ESTIMATE_MINUTES = 24 * 60
    const val COMPLETED_HISTORY_DAYS = 14L
    const val DAY_SECONDS = 86_400L
}
