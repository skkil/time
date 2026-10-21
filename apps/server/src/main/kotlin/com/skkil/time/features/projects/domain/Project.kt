package com.skkil.time.features.projects.domain

import java.time.LocalDate
import java.util.UUID

data class Project(
    val id: UUID,
    val parentId: UUID?,
    val name: String,
    val color: String,
    val position: Int,
    val archived: Boolean,
    val view: String,
    val groupId: UUID?,
    val status: String,
    val outcome: String,
    val weeklyMinutes: Int?,
    val targetDate: LocalDate?,
    val killCriteria: String,
    val reviewEveryWeeks: Int,
    val lastReviewedAt: Long?,
    val inOrder: Boolean,
    val preset: String,
    val milestoneLabel: String,
)
