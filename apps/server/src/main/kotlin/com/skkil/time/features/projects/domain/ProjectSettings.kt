package com.skkil.time.features.projects.domain

import java.time.LocalDate
import java.util.UUID

data class ProjectSettings(
    val groupId: UUID?,
    val status: String,
    val outcome: String,
    val weeklyMinutes: Int?,
    val targetDate: LocalDate?,
    val killCriteria: String,
    val reviewEveryWeeks: Int,
    val inOrder: Boolean,
)
