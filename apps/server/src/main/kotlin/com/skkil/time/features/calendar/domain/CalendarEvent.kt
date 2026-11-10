package com.skkil.time.features.calendar.domain

import java.time.LocalDate
import java.util.UUID

/**
 * An event of a visible calendar. An all-day event covers [startDate] up to, not including, [endDate], and its
 * [startAt] and [endAt] are those days' midnights in the caller's zone.
 */
data class CalendarEvent(
    val id: UUID,
    val sourceId: UUID,
    val sourceName: String,
    val color: String,
    val title: String,
    val startAt: Long,
    val endAt: Long,
    val allDay: Boolean,
    val startDate: LocalDate?,
    val endDate: LocalDate?,
    val location: String?,
    val link: String?,
    val tentative: Boolean,
)
