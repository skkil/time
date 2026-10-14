package com.skkil.time.features.time.domain

data class TimeBlock(
    val id: Long,
    val taskId: Long,
    val title: String,
    val projectId: Long?,
    val priority: Int,
    val completed: Boolean,
    val startAt: Long,
    val endAt: Long,
)
