package com.skkil.time.features.tasks.domain

import java.time.LocalDate
import java.util.UUID

data class TaskInput(
    val title: String,
    val notes: String,
    val projectId: UUID?,
    val sectionId: UUID?,
    val parentId: UUID?,
    val priority: Int,
    val dueDate: LocalDate?,
    val dueTime: Int?,
    val deadline: LocalDate?,
    val recurrence: String?,
    val estimateMinutes: Int?,
)
