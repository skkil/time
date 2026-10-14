package com.skkil.time.features.workflow.domain

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
