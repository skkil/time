package com.skkil.time.features.workflow.domain

data class ItemTypeInput(
    val name: String,
    val icon: String,
    val kind: String,
    val defaultMinutes: Int?,
    val checklist: String,
)
