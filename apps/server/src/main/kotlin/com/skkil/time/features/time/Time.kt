package com.skkil.time.features.time

data class TimeBlock(
    val id: Long,
    val taskId: Long,
    val title: String,
    val projectId: Long?,
    val priority: Int,
    val completed: Boolean,
    val startAt: Long,
    val endAt: Long,
)

data class BlockSpan(val startAt: Long, val endAt: Long)

data class TimeEntry(
    val id: Long,
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val endedAt: Long,
)

data class TrackedEntry(
    val id: Long,
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val endedAt: Long,
    val taskTitle: String?,
    val taskCompleted: Boolean,
)

data class EntryDetails(val description: String, val projectId: Long?, val taskId: Long?)

data class EntryInput(
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val endedAt: Long,
) {
    fun details() = EntryDetails(description, projectId, taskId)
}

data class RunningTimer(
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val pausedAt: Long?,
    val bankedSeconds: Long,
)

object TimeRules {
    const val MINUTE = 60L
    const val DAY_SECONDS = 86_400L
    const val FUTURE_TOLERANCE_SECONDS = 60L
}
