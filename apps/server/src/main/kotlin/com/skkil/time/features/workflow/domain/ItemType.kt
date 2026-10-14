package com.skkil.time.features.workflow.domain

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
