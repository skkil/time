package com.skkil.time.features.tasks.domain

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping
import io.swagger.v3.oas.annotations.media.Schema
import java.time.LocalDate

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes(
    JsonSubTypes.Type(MoveTarget.Day::class, name = "day"),
    JsonSubTypes.Type(MoveTarget.Week::class, name = "week"),
    JsonSubTypes.Type(MoveTarget.Someday::class, name = "someday"),
)
@Schema(
    discriminatorProperty = "kind",
    discriminatorMapping = [
        DiscriminatorMapping("day", schema = MoveTarget.Day::class),
        DiscriminatorMapping("week", schema = MoveTarget.Week::class),
        DiscriminatorMapping("someday", schema = MoveTarget.Someday::class),
    ],
)
sealed interface MoveTarget {
    @Schema(name = "MoveToDay")
    data class Day(val date: LocalDate) : MoveTarget

    @Schema(name = "MoveToWeek")
    data class Week(val monday: LocalDate) : MoveTarget

    @Schema(name = "MoveToSomeday")
    data object Someday : MoveTarget
}
