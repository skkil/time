package com.skkil.time.features.review.domain

import java.util.UUID

data class Outcome(
    val id: UUID,
    val title: String,
    val status: OutcomeStatus,
    val priorityId: UUID?,
    val carriedFrom: UUID?,
    val timesCarried: Int,
    val tasksTotal: Int,
    val tasksDone: Int,
    val trackedSeconds: Long,
)
