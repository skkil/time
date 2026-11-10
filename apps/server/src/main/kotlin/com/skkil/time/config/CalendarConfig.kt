package com.skkil.time.config

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.features.calendar.provider.FakeCalendarProvider
import com.skkil.time.features.calendar.provider.GoogleCalendarProvider
import com.skkil.time.features.calendar.service.CalendarConnector
import com.skkil.time.features.calendar.service.TokenCipher
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import tools.jackson.databind.json.JsonMapper

/**
 * Picks the calendar provider: `fake` for `skkil dev` and tests (tokens sealed with [AppProperties.Calendar.tokenKey]
 * or a key made at startup), else Google once its client and the token key are configured, else none.
 */
@Configuration
class CalendarConfig {
    @Bean
    fun calendarConnector(properties: AppProperties, mapper: JsonMapper, clock: MutationClock): CalendarConnector {
        val calendar = properties.calendar
        val key = calendar.tokenKey.takeIf { it.isNotBlank() }?.let(TokenCipher::fromBase64)
        if (calendar.provider == FAKE) {
            return CalendarConnector(FakeCalendarProvider(calendar.redirectUri, clock) to (key ?: TokenCipher.random()))
        }
        if (calendar.googleClientId.isBlank() || calendar.googleClientSecret.isBlank() || key == null) {
            log.info("Google Calendar is off: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and CALENDAR_TOKEN_KEY")
            return CalendarConnector(null)
        }
        val google =
            GoogleCalendarProvider(
                calendar.googleClientId,
                calendar.googleClientSecret,
                calendar.redirectUri,
                mapper,
                clock,
            )
        return CalendarConnector(google to key)
    }

    private companion object {
        const val FAKE = "fake"
        val log = LoggerFactory.getLogger(CalendarConfig::class.java)
    }
}
