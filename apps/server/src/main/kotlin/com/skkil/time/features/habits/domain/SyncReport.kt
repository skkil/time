package com.skkil.time.features.habits.domain

data class SyncReport(
    val activitywatch: TrackerState,
    val hasWebData: Boolean,
    val hasWindowData: Boolean,
    val message: String?,
)
