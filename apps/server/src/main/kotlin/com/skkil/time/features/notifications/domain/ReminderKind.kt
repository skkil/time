package com.skkil.time.features.notifications.domain

import com.fasterxml.jackson.annotation.JsonValue

enum class ReminderKind(
    @JsonValue val wire: String,
) {
    TASK("task"),
    BLOCK("block"),
    EVENT("event"),
}
