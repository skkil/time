package com.skkil.time.features.projects

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

data class ProjectInput(val name: String, val parentId: Long?, val color: String)

data class ProjectSettings(
    val groupId: Long?,
    val status: String,
    val outcome: String,
    val weeklyMinutes: Int?,
    val targetDate: LocalDate?,
    val killCriteria: String,
    val reviewEveryWeeks: Int,
    val inOrder: Boolean,
)

data class Group(val id: Long, val name: String, val position: Int)

data class GroupName(val name: String)

data class ProjectCanvas(val projectId: Long, val content: String, val updatedAt: Long?)

data class CanvasContent(val content: String)

data class Archived(val archived: Boolean)

data class ProjectView(val view: String)

object ProjectRules {
    val COLORS = listOf("graphite", "blue", "teal", "green", "olive", "amber", "rust", "plum")
    const val MAX_DEPTH = 3
    val VIEWS = listOf("list", "board")
    val STATUSES = listOf("active", "paused", "done", "dropped")
    val REVIEW_WEEKS = listOf(1, 2, 4)
    const val MAX_CANVAS = 2_000_000
}
