package com.skkil.time.features.calendar.provider

import java.time.Instant

/** The stretch of time the server keeps events for. */
data class EventWindow(val from: Instant, val to: Instant) {
    fun overlaps(event: ProviderEvent): Boolean = event.start < to.epochSecond && event.end > from.epochSecond
}
