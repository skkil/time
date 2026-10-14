package com.skkil.time.features.review.domain

import com.fasterxml.jackson.annotation.JsonProperty

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
