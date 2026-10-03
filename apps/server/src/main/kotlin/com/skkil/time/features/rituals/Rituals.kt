package com.skkil.time.features.rituals

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.skkil.time.common.Caller
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping
import io.swagger.v3.oas.annotations.media.Schema
import java.time.Instant
import java.time.LocalDate

data class Ritual(
    val kind: String,
    val enabled: Boolean,
    val trigger: String,
    val atMinute: Int,
    val weekdays: Int,
    val minMinutes: Int,
    val steps: List<String>,
)

data class RitualInput(
    val enabled: Boolean,
    val trigger: String,
    val atMinute: Int,
    val weekdays: Int,
    val steps: List<String>,
)

data class RitualRun(
    val id: Long,
    val kind: String,
    val date: LocalDate,
    val taskId: Long?,
    val startedAt: Long,
    val finishedAt: Long?,
    val skipped: Boolean,
    val step: Int,
    val snoozedUntil: Long?,
)

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(RitualEvent.Open::class, name = "open"),
    JsonSubTypes.Type(RitualEvent.Tick::class, name = "tick"),
    JsonSubTypes.Type(RitualEvent.TimerStopped::class, name = "timerStopped"),
)
@Schema(
    discriminatorProperty = "kind",
    discriminatorMapping = [
        DiscriminatorMapping("open", schema = RitualEvent.Open::class),
        DiscriminatorMapping("tick", schema = RitualEvent.Tick::class),
        DiscriminatorMapping("timerStopped", schema = RitualEvent.TimerStopped::class),
    ],
)
sealed interface RitualEvent {
    @Schema(name = "RitualOpen")
    data object Open : RitualEvent

    @Schema(name = "RitualTick")
    data object Tick : RitualEvent

    @Schema(name = "RitualTimerStopped")
    data class TimerStopped(val minutes: Int) : RitualEvent
}

/** A point in the caller's day: the local date, minutes since local midnight and the epoch second. */
data class Moment(val date: LocalDate, val minute: Int, val stamp: Long) {
    companion object {
        fun now(caller: Caller): Moment {
            val stamp = caller.now()
            val local = Instant.ofEpochSecond(stamp).atZone(caller.zone)
            return Moment(local.toLocalDate(), local.hour * 60 + local.minute, stamp)
        }
    }
}

data class PlanningTime(val time: String?)

data class PlanningChoice(val time: String)

data class RitualTask(val taskId: Long?)

data class RitualStep(val step: Int)
