package com.skkil.time.features.rituals.domain

import java.time.LocalDate

data class RitualRun(
    val id: Long,
    val kind: String,
    val date: LocalDate,
    val taskId: Long?,
    val startedAt: Long,
    val finishedAt: Long?,
    val skipped: Boolean,
    val step: Int,
    val snoozedUntil: Long?,
)
