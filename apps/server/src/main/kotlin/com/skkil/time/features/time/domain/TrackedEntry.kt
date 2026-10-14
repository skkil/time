package com.skkil.time.features.time.domain

data class TrackedEntry(
    val id: Long,
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val endedAt: Long,
    val taskTitle: String?,
    val taskCompleted: Boolean,
)
