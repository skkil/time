package com.skkil.time.features.time.domain

import java.util.UUID

data class TimeBlock(
    val id: UUID,
    val taskId: UUID,
    val title: String,
    val projectId: UUID?,
    val priority: Int,
    val completed: Boolean,
    val startAt: Long,
    val endAt: Long,
)
