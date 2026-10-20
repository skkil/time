package com.skkil.time.features.workflow.domain

import java.util.UUID

data class ItemType(
    val id: UUID,
    val projectId: UUID,
    val name: String,
    val icon: String,
    val kind: String,
    val defaultMinutes: Int?,
    val checklist: String,
    val position: Int,
)
