package com.skkil.time.features.workflow

import java.time.LocalDate

data class ItemType(
    val id: Long,
    val projectId: Long,
    val name: String,
    val icon: String,
    val kind: String,
    val defaultMinutes: Int?,
    val checklist: String,
    val position: Int,
)

data class ItemTypeInput(
    val name: String,
    val icon: String,
    val kind: String,
    val defaultMinutes: Int?,
    val checklist: String,
)

data class ItemStatus(val id: Long, val projectId: Long, val name: String, val category: String, val position: Int)

data class StatusInput(val name: String, val category: String)

data class Milestone(val id: Long, val projectId: Long, val name: String, val date: LocalDate?, val position: Int)

data class MilestoneInput(val name: String, val date: LocalDate?)

data class SavedView(
    val id: Long,
    val projectId: Long,
    val name: String,
    val layout: String,
    val groupBy: String,
    val filter: String,
    val sort: String,
    val position: Int,
)

data class ViewInput(val name: String, val layout: String, val groupBy: String, val filter: String, val sort: String)

data class Workflow(
    val types: List<ItemType>,
    val statuses: List<ItemStatus>,
    val milestones: List<Milestone>,
    val views: List<SavedView>,
)

data class Preset(
    val key: String,
    val name: String,
    val description: String,
    val types: List<ItemTypeInput>,
    val statuses: List<StatusInput>,
    val milestoneLabel: String,
    val views: List<ViewInput>,
)

data class EventOccurrence(
    val taskId: Long,
    val title: String,
    val projectId: Long?,
    val typeId: Long?,
    val startAt: Long,
    val endAt: Long,
    val location: String,
    val countsAsTime: Boolean,
)

data class TypeTime(val name: String, val icon: String, val seconds: Long)

data class PresetText(val text: String)

data class MilestoneLabel(val label: String)

data class StatusPlacement(val before: Long?)

data class TaskTypeId(val typeId: Long?)

data class TaskStatusId(val statusId: Long)

data class TaskMilestoneId(val milestoneId: Long?)

data class TaskEventDetails(val location: String, val countsAsTime: Boolean)

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
