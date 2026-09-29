package com.skkil.time.features.habits

import com.fasterxml.jackson.annotation.JsonProperty
import java.time.LocalDate

data class Tracking(val source: String, val patterns: List<String>, val projectId: Long?)

data class Habit(
    val id: Long,
    val name: String,
    val kind: String,
    val goal: Double,
    val unit: String,
    val days: Int,
    val timeOfDay: String,
    val area: String,
    val startDate: LocalDate,
    val tracking: Tracking?,
    val skipDays: Int,
    val anchor: String,
    val doneDays: Int,
    val dueDays: Int,
    val cleanSince: LocalDate?,
)

data class HabitInput(
    val name: String,
    val kind: String,
    val goal: Double?,
    val unit: String,
    val days: Int,
    val timeOfDay: String,
    val area: String,
    val startDate: LocalDate,
    val tracking: Tracking?,
    val skipDays: Int,
    val anchor: String,
)

enum class DayStatus {
    @JsonProperty("done")
    DONE,

    @JsonProperty("failed")
    FAILED,

    @JsonProperty("skipped")
    SKIPPED,

    @JsonProperty("pending")
    PENDING,

    @JsonProperty("missed")
    MISSED,

    @JsonProperty("off")
    OFF,
}

enum class ManualStatus(val value: String) {
    @JsonProperty("done")
    DONE("done"),

    @JsonProperty("failed")
    FAILED("failed"),

    @JsonProperty("skipped")
    SKIPPED("skipped"),
}

data class HabitDay(
    val habitId: Long,
    val date: LocalDate,
    val status: DayStatus,
    val value: Double,
    val manual: Boolean,
)

data class HabitStatus(val status: ManualStatus?)

data class HabitDelta(val delta: Double?)

enum class TrackerState {
    @JsonProperty("notNeeded")
    NOT_NEEDED,

    @JsonProperty("connected")
    CONNECTED,

    @JsonProperty("unreachable")
    UNREACHABLE,
}

data class SyncReport(
    val activitywatch: TrackerState,
    val hasWebData: Boolean,
    val hasWindowData: Boolean,
    val message: String?,
)
