package com.skkil.time.features.calendar.domain

import java.util.UUID

/** One calendar of a connected account, as devices see it. */
data class CalendarSource(
    val id: UUID,
    val accountId: UUID,
    val name: String,
    val color: String,
    val visible: Boolean,
    val position: Int,
)
