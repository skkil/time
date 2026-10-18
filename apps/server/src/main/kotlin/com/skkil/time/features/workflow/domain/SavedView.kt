package com.skkil.time.features.workflow.domain

import java.util.UUID

data class SavedView(
    val id: UUID,
    val projectId: UUID,
    val name: String,
    val layout: String,
    val groupBy: String,
    val filter: String,
    val sort: String,
    val position: Int,
)
