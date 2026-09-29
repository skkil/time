package com.skkil.time.features.habits

import com.skkil.time.common.Caller
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
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

@RestController
@RequestMapping("/api/v1/habits")
class HabitController(private val habits: HabitService) {
    @GetMapping
    fun list(caller: Caller): List<Habit> = habits.list(caller)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody input: HabitInput,
    ): Habit = habits.create(caller, input)

    @PutMapping("/{id}")
    fun update(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: HabitInput,
    ): Habit = habits.update(caller, id, input)

    @PostMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun archive(
        caller: Caller,
        @PathVariable id: Long,
    ) = habits.archive(caller.id, id)

    @GetMapping("/days")
    fun days(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<HabitDay> = habits.days(caller, from, to)

    @PutMapping("/{id}/days/{date}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setStatus(
        caller: Caller,
        @PathVariable id: Long,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: HabitStatus,
    ) = habits.setStatus(caller, id, date, body.status)

    @PostMapping("/{id}/days/{date}/value")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun addValue(
        caller: Caller,
        @PathVariable id: Long,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: HabitDelta,
    ) = habits.addValue(caller, id, date, body.delta)

    @PostMapping("/sync")
    fun sync(caller: Caller): SyncReport = habits.sync(caller)
}
