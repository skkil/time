package com.skkil.time.features.calendar.api

import com.skkil.time.common.error.DomainException
import com.skkil.time.features.calendar.service.CalendarService
import io.swagger.v3.oas.annotations.Hidden
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.util.HtmlUtils

/**
 * Where the provider sends the browser back after consent. It carries no sign-in: the state names the person who
 * started connecting. The answer is a short page to close.
 */
@Hidden
@RestController
class CalendarCallbackController(private val calendars: CalendarService) {
    @GetMapping(CALLBACK, produces = [MediaType.TEXT_HTML_VALUE])
    fun googleCallback(
        @RequestParam(required = false) state: String?,
        @RequestParam(required = false) code: String?,
        @RequestParam(required = false) error: String?,
    ): ResponseEntity<String> {
        if (state == null || code == null || error != null) {
            return page(
                HttpStatus.BAD_REQUEST,
                "Not connected",
                "Google Calendar wasn't connected. You can close this tab.",
            )
        }
        return try {
            calendars.finish(state, code)
            page(
                HttpStatus.OK,
                "Calendar connected",
                "Google Calendar is connected. Close this tab and go back to skkil time: your events appear in a moment.",
            )
        } catch (refused: DomainException) {
            page(HttpStatus.BAD_REQUEST, "Not connected", refused.message.orEmpty())
        }
    }

    private fun page(status: HttpStatus, title: String, message: String): ResponseEntity<String> =
        ResponseEntity
            .status(status)
            .contentType(MediaType.TEXT_HTML)
            .body(
                """
                <!doctype html>
                <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
                <title>${HtmlUtils.htmlEscape(title)} · skkil time</title></head>
                <body><h1>${HtmlUtils.htmlEscape(title)}</h1><p>${HtmlUtils.htmlEscape(message)}</p></body></html>
                """.trimIndent(),
            )

    companion object {
        const val CALLBACK = "/api/v1/calendar/google/callback"
    }
}
