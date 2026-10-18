package com.skkil.time.features.time.domain

import java.util.UUID

data class RunningTimer(
    val description: String,
    val projectId: UUID?,
    val taskId: UUID?,
    val startedAt: Long,
    val pausedAt: Long?,
    val bankedSeconds: Long,
)
