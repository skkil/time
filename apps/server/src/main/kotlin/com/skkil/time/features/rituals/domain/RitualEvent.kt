package com.skkil.time.features.rituals.domain

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping
import io.swagger.v3.oas.annotations.media.Schema

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
