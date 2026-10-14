package com.skkil.time.features.tasks.domain

import java.time.LocalDate

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
