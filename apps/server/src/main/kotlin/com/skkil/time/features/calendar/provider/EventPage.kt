package com.skkil.time.features.calendar.provider

/**
 * What one read returned. A [full] read lists every event of the window, so the ones it leaves out are gone; an
 * incremental read lists only changes. [syncToken] continues from here.
 */
data class EventPage(val events: List<ProviderEvent>, val syncToken: String?, val full: Boolean)
