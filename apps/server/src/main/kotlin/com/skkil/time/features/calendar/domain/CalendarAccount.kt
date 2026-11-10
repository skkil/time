package com.skkil.time.features.calendar.domain

import java.util.UUID

/** A connected calendar account as its owner sees it; [status] is `active`, or `reauth` once access was lost. */
data class CalendarAccount(
    val id: UUID,
    val provider: String,
    val email: String?,
    val status: String,
    val syncedAt: Long?,
)
