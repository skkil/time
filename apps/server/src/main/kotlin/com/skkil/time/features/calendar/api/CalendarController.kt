package com.skkil.time.features.calendar.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.calendar.domain.CalendarEvent
import com.skkil.time.features.calendar.domain.CalendarSource
import com.skkil.time.features.calendar.domain.CalendarStatus
import com.skkil.time.features.calendar.domain.ConnectLink
import com.skkil.time.features.calendar.service.CalendarService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.util.UUID

@RestController
@RequestMapping("/api/v1/calendar")
class CalendarController(private val calendars: CalendarService) {
    @GetMapping
    fun calendarStatus(caller: Caller): CalendarStatus = calendars.status(caller)

    @PostMapping("/google/connect")
    fun connectGoogleCalendar(caller: Caller): ConnectLink = calendars.connect(caller)

    @DeleteMapping("/accounts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun disconnectCalendar(
        caller: Caller,
        @PathVariable id: UUID,
    ) = calendars.disconnect(caller, id)

    @GetMapping("/sources")
    fun listCalendarSources(caller: Caller): List<CalendarSource> = calendars.sources(caller)

    @PutMapping("/sources/{id}/visible")
    fun setCalendarSourceVisible(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: SourceVisible,
    ): CalendarSource = calendars.setVisible(caller, id, body.visible)

    @GetMapping("/events")
    fun listCalendarEvents(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<CalendarEvent> = calendars.events(caller, from, to)
}
