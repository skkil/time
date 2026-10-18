package com.skkil.time.features.time.domain

import java.util.UUID

data class TrackedEntry(
    val id: UUID,
    val description: String,
    val projectId: UUID?,
    val taskId: UUID?,
    val startedAt: Long,
    val endedAt: Long,
    val taskTitle: String?,
    val taskCompleted: Boolean,
)
