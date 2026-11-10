package com.skkil.time.features.time.domain

import java.util.UUID

data class TimeEntry(
    val id: UUID,
    val description: String,
    val projectId: UUID?,
    val taskId: UUID?,
    val startedAt: Long,
    val endedAt: Long,
    val source: String,
)
