package com.skkil.time.features.calendar.service

import com.skkil.time.common.error.invalid
import com.skkil.time.features.calendar.provider.CalendarProvider

/** The configured calendar provider with the cipher for its tokens, or neither when calendars aren't set up here. */
class CalendarConnector(private val configured: Pair<CalendarProvider, TokenCipher>?) {
    val available: Boolean = configured != null

    val provider: CalendarProvider get() = (configured ?: invalid(NOT_SET_UP)).first

    val cipher: TokenCipher get() = (configured ?: invalid(NOT_SET_UP)).second

    companion object {
        const val NOT_SET_UP = "Calendars aren't set up on this server."
    }
}
