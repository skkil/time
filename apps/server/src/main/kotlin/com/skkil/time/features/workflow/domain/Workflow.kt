package com.skkil.time.features.workflow.domain

data class Workflow(
    val types: List<ItemType>,
    val statuses: List<ItemStatus>,
    val milestones: List<Milestone>,
    val views: List<SavedView>,
)
