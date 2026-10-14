package com.skkil.time.features.review.domain

import java.time.LocalDate

data class WeekSummary(
    val startDate: LocalDate,
    val felt: Int?,
    val step: Int,
    val reviewedAt: Long?,
    val outcomesTotal: Int,
    val outcomesAchieved: Int,
    val trackedSeconds: Long,
    val plannedSeconds: Long,
    val tasksCompleted: Int,
)
