package com.skkil.time.features.calendar.provider

/**
 * A calendar service the server reads for its users: OAuth with PKCE run by the server, then calendars and their
 * events. Failures throw [ProviderException]. Google is the only real one; [FakeCalendarProvider] serves fixtures.
 */
interface CalendarProvider {
    /** Where to send the person to consent, coming back to the callback with a code and [state]. */
    fun authorizeUrl(state: String, challenge: String): String

    fun exchange(code: String, verifier: String): ProviderTokens

    fun refresh(refreshToken: String): ProviderTokens

    fun revoke(token: String)

    fun calendars(accessToken: String): List<ProviderCalendar>

    /**
     * Events of one calendar: every event in [window] when [syncToken] is null, else what changed since the token,
     * cancellations included.
     */
    fun events(accessToken: String, calendarId: String, window: EventWindow, syncToken: String?): EventPage
}
