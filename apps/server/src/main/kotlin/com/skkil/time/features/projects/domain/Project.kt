package com.skkil.time.features.projects.domain

import java.time.LocalDate

data class Project(
    val id: Long,
    val parentId: Long?,
    val name: String,
    val color: String,
    val position: Int,
    val archived: Boolean,
    val view: String,
    val groupId: Long?,
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
