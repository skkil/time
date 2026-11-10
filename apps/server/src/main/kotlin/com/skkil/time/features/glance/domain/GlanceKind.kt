package com.skkil.time.features.glance.domain

import com.fasterxml.jackson.annotation.JsonValue

enum class GlanceKind(
    @JsonValue val wire: String,
) {
    BLOCK("block"),
    TASK("task"),
    EVENT("event"),
}
