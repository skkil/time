package com.skkil.time.features.habits.domain

import com.fasterxml.jackson.annotation.JsonProperty

enum class ManualStatus(val value: String) {
    @JsonProperty("done")
    DONE("done"),

    @JsonProperty("failed")
    FAILED("failed"),

    @JsonProperty("skipped")
    SKIPPED("skipped"),
}
