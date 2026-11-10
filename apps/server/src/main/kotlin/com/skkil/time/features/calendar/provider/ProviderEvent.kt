package com.skkil.time.features.calendar.provider

/**
 * One event (one instance of a repeating event). Times are epoch seconds; an all-day event starts and ends at UTC
 * midnight of its first day and of the day after its last.
 */
data class ProviderEvent(
    val id: String,
    val status: String,
    val title: String,
    val start: Long,
    val end: Long,
    val allDay: Boolean,
    val location: String?,
    val link: String?,
    val updated: Long,
) {
    val cancelled: Boolean get() = status == CANCELLED

    companion object {
        const val CANCELLED = "cancelled"
    }
}
