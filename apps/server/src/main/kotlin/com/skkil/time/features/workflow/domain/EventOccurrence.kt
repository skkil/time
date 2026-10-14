package com.skkil.time.features.workflow.domain

data class EventOccurrence(
    val taskId: Long,
    val title: String,
    val projectId: Long?,
    val typeId: Long?,
    val startAt: Long,
    val endAt: Long,
    val location: String,
    val countsAsTime: Boolean,
)
