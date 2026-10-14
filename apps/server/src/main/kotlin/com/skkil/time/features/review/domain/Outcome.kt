package com.skkil.time.features.review.domain

data class Outcome(
    val id: Long,
    val title: String,
    val status: OutcomeStatus,
    val priorityId: Long?,
    val carriedFrom: Long?,
    val timesCarried: Int,
    val tasksTotal: Int,
    val tasksDone: Int,
    val trackedSeconds: Long,
)
