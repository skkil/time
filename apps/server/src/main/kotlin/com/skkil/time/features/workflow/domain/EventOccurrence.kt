package com.skkil.time.features.workflow.domain

import java.util.UUID

data class EventOccurrence(
    val taskId: UUID,
    val title: String,
    val projectId: UUID?,
    val typeId: UUID?,
    val startAt: Long,
    val endAt: Long,
    val location: String,
    val countsAsTime: Boolean,
)
