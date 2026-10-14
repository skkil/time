package com.skkil.time.features.time.domain

data class RunningTimer(
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val pausedAt: Long?,
    val bankedSeconds: Long,
)
