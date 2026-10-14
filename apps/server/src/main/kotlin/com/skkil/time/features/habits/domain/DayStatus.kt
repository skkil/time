package com.skkil.time.features.habits.domain

import com.fasterxml.jackson.annotation.JsonProperty

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
