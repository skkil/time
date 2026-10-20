package com.skkil.time.features.time.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.time.domain.EntryDetails
import com.skkil.time.features.time.domain.EntryInput
import com.skkil.time.features.time.domain.RunningTimer
import com.skkil.time.features.time.domain.TimeEntry
import com.skkil.time.features.time.domain.TrackedEntry
import com.skkil.time.features.time.service.EntryService
import com.skkil.time.features.time.service.TimerService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
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
@RequestMapping("/api/v1")
class TimeController(private val entries: EntryService, private val timer: TimerService) {
    @GetMapping("/time-entries")
    fun listTimeEntries(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<TimeEntry> = entries.list(caller, from, to)

    @GetMapping("/tasks/{id}/time-entries")
    fun listTaskEntries(
        caller: Caller,
        @PathVariable id: UUID,
    ): List<TrackedEntry> = entries.listForTask(caller.id, id)

    @GetMapping("/projects/{id}/time-entries")
    fun listProjectEntries(
        caller: Caller,
        @PathVariable id: UUID,
    ): List<TrackedEntry> = entries.listForProject(caller.id, id)

    @PostMapping("/time-entries")
    fun createTimeEntry(
        caller: Caller,
        @RequestBody input: EntryInput,
    ): TimeEntry = entries.create(caller, input)

    @PutMapping("/time-entries/{id}")
    fun updateTimeEntry(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: EntryInput,
    ): TimeEntry = entries.update(caller, id, input)

    @DeleteMapping("/time-entries/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteTimeEntry(
        caller: Caller,
        @PathVariable id: UUID,
    ) = entries.delete(caller.id, id)

    /** The running timer, or 204 when none is. */
    @GetMapping("/timer")
    fun getTimer(caller: Caller): ResponseEntity<RunningTimer> = orNoContent(timer.running(caller.id))

    @PostMapping("/timer")
    fun startTimer(
        caller: Caller,
        @RequestBody details: EntryDetails,
    ): RunningTimer = timer.start(caller, details)

    @PutMapping("/timer")
    fun editTimer(
        caller: Caller,
        @RequestBody details: EntryDetails,
    ): RunningTimer = timer.edit(caller, details)

    /** The entry the stretch so far became, or 204 when it logged nothing. */
    @PostMapping("/timer/stop")
    fun stopTimer(caller: Caller): ResponseEntity<TimeEntry> = orNoContent(timer.stop(caller))

    @PostMapping("/timer/pause")
    fun pauseTimer(caller: Caller): RunningTimer = timer.pause(caller)

    @PostMapping("/timer/resume")
    fun resumeTimer(caller: Caller): RunningTimer = timer.resume(caller)

    @DeleteMapping("/timer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun discardTimer(caller: Caller) = timer.discard(caller.id)

    @PostMapping("/timer/restore")
    fun restoreTimer(
        caller: Caller,
        @RequestBody running: RunningTimer,
    ): RunningTimer = timer.restore(caller, running)

    private fun <T : Any> orNoContent(body: T?): ResponseEntity<T> =
        body?.let { ResponseEntity.ok(it) } ?: ResponseEntity.noContent().build()
}
