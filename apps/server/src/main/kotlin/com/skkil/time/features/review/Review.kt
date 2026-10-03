package com.skkil.time.features.review

import com.fasterxml.jackson.annotation.JsonProperty
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

data class Day(val date: LocalDate, val felt: Int?, val note: String, val skipped: Boolean)

data class WeekNotes(val worked: String = "", val fellShort: String = "", val change: String = "")

enum class OutcomeStatus(val value: String) {
    @JsonProperty("open")
    OPEN("open"),

    @JsonProperty("achieved")
    ACHIEVED("achieved"),

    @JsonProperty("carried")
    CARRIED("carried"),

    @JsonProperty("dropped")
    DROPPED("dropped"),
    ;

    companion object {
        fun parse(value: String): OutcomeStatus = entries.first { it.value == value }
    }
}

data class Outcome(
    val id: Long,
    val title: String,
    val status: OutcomeStatus,
    val priorityId: Long?,
    val carriedFrom: Long?,
    val timesCarried: Int,
    val tasksTotal: Int,
    val tasksDone: Int,
    val trackedSeconds: Long,
)

data class Week(
    val startDate: LocalDate,
    val felt: Int?,
    val step: Int,
    val reviewedAt: Long?,
    val notes: WeekNotes,
    val outcomes: List<Outcome>,
)

data class WeekSummary(
    val startDate: LocalDate,
    val felt: Int?,
    val step: Int,
    val reviewedAt: Long?,
    val outcomesTotal: Int,
    val outcomesAchieved: Int,
    val trackedSeconds: Long,
    val plannedSeconds: Long,
    val tasksCompleted: Int,
)

data class Priority(val id: Long, val title: String, val note: String, val achieved: Int)

data class Quarter(
    val id: Long,
    val label: String,
    val startDate: LocalDate,
    val weekNo: Int,
    val priorities: List<Priority>,
)

data class Felt(val felt: Int)

data class DayNote(val note: String)

data class ReviewStep(val step: Int)

data class OutcomeInput(val title: String, val priorityId: Long?)

data class OutcomeStatusInput(val status: OutcomeStatus)

data class QuarterInput(val label: String, val startDate: LocalDate)

data class PriorityTitle(val title: String)

data class PriorityInput(val title: String, val note: String)

fun LocalDate.monday(): LocalDate = with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
