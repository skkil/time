package com.skkil.time.features.workflow.domain

data class Preset(
    val key: String,
    val name: String,
    val description: String,
    val types: List<ItemTypeInput>,
    val statuses: List<StatusInput>,
    val milestoneLabel: String,
    val views: List<ViewInput>,
)
