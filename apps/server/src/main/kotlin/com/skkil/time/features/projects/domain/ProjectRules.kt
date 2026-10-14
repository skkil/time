package com.skkil.time.features.projects.domain

object ProjectRules {
    val COLORS = listOf("graphite", "blue", "teal", "green", "olive", "amber", "rust", "plum")
    const val MAX_DEPTH = 3
    val VIEWS = listOf("list", "board")
    val STATUSES = listOf("active", "paused", "done", "dropped")
    val REVIEW_WEEKS = listOf(1, 2, 4)
    const val MAX_CANVAS = 2_000_000
}
