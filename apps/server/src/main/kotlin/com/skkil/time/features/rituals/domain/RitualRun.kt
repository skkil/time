package com.skkil.time.features.rituals.domain

import java.time.LocalDate
import java.util.UUID

data class RitualRun(
    val id: UUID,
    val kind: String,
    val date: LocalDate,
    val taskId: UUID?,
    val startedAt: Long,
    val finishedAt: Long?,
    val skipped: Boolean,
    val step: Int,
    val snoozedUntil: Long?,
)
