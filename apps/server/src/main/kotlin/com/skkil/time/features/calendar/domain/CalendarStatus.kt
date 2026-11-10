package com.skkil.time.features.calendar.domain

/** Whether this server can connect calendars, and the caller's connected accounts. */
data class CalendarStatus(val available: Boolean, val accounts: List<CalendarAccount>)
