package com.skkil.time.features.notifications.domain

import java.util.UUID

data class Reminder(
    val key: String,
    val kind: ReminderKind,
    val at: Long,
    val title: String,
    val startsAt: Long,
    val taskId: UUID,
    val blockId: UUID?,
    val location: String,
)
