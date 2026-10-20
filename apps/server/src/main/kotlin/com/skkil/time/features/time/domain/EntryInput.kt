package com.skkil.time.features.time.domain

import java.util.UUID

data class EntryInput(
    val description: String,
    val projectId: UUID?,
    val taskId: UUID?,
    val startedAt: Long,
    val endedAt: Long,
) {
    fun details() = EntryDetails(description, projectId, taskId)
}
