package com.skkil.time.features.tasks.domain

import java.time.LocalDate
import java.util.UUID

data class Task(
    val id: UUID,
    val title: String,
    val notes: String,
    val projectId: UUID?,
    val sectionId: UUID?,
    val parentId: UUID?,
    val priority: Int,
    val dueDate: LocalDate?,
    val dueUntil: LocalDate?,
    val dueTime: Int?,
    val deadline: LocalDate?,
    val recurrence: String?,
    val estimateMinutes: Int?,
    val position: Int,
    val completedAt: Long?,
    val createdAt: Long,
    val trackedSeconds: Long,
    val outcomeId: UUID?,
    val nextStep: String,
    val mustOn: LocalDate?,
    val typeId: UUID?,
    val statusId: UUID?,
    val milestoneId: UUID?,
    val location: String,
    val countsAsTime: Boolean,
    val statusChangedAt: Long?,
    val kind: String,
    val statusCategory: String?,
    val blockedBy: List<UUID>,
    val waitingOn: List<UUID>,
    val phaseId: UUID?,
)
