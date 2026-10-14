package com.skkil.time.features.habits.domain

import com.fasterxml.jackson.annotation.JsonProperty

enum class TrackerState {
    @JsonProperty("notNeeded")
    NOT_NEEDED,

    @JsonProperty("connected")
    CONNECTED,

    @JsonProperty("unreachable")
    UNREACHABLE,
}
