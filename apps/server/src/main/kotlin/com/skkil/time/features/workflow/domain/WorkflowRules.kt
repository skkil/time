package com.skkil.time.features.workflow.domain

object WorkflowRules {
    val CATEGORIES = listOf("backlog", "todo", "active", "done", "dropped")
    val KINDS = listOf("task", "event", "record")
    val LAYOUTS = listOf("list", "board", "calendar", "table")
    val GROUPS = listOf("section", "type", "status", "milestone", "date", "none")
    val SORTS = listOf("manual", "date", "deadline", "priority", "title", "created")
    val ICONS =
        listOf(
            "circle",
            "square",
            "sparkles",
            "bug",
            "wrench",
            "git-pull-request",
            "users",
            "repeat",
            "book-open",
            "file-text",
            "pencil",
            "graduation-cap",
            "clipboard-check",
            "timer",
            "flag",
            "mail",
            "phone",
            "briefcase",
            "calendar",
            "target",
            "lightbulb",
            "bookmark",
            "message-circle",
            "presentation",
        )
    const val DEFAULT_EVENT_MINUTES = 60
    const val MAX_CHECKLIST = 30
}
