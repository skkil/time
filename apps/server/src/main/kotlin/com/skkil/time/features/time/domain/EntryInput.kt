package com.skkil.time.features.time.domain

data class EntryInput(
    val description: String,
    val projectId: Long?,
    val taskId: Long?,
    val startedAt: Long,
    val endedAt: Long,
) {
    fun details() = EntryDetails(description, projectId, taskId)
}
