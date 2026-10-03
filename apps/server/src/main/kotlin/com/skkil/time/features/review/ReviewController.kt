package com.skkil.time.features.review

import com.skkil.time.common.Caller
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

@RestController
@RequestMapping("/api/v1")
class ReviewController(private val review: ReviewService, private val quarters: QuarterService) {
    @GetMapping("/days")
    fun days(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<Day> = review.days(caller.id, from, to)

    @PutMapping("/days/{date}/felt")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun rateDay(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: Felt,
    ) = review.setDayFelt(caller, date, body.felt)

    @PutMapping("/days/{date}/note")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun saveDayNote(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: DayNote,
    ) = review.setDayNote(caller, date, body.note)

    @PostMapping("/days/{date}/skip")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun skipDay(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
    ) = review.skipDay(caller.id, date)

    @GetMapping("/weeks")
    fun weeks(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<WeekSummary> = review.weeks(caller, from, to)

    @GetMapping("/weeks/{date}")
    fun week(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
    ): Week = review.week(caller, date)

    @PutMapping("/weeks/{date}/notes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun saveWeekNotes(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: WeekNotes,
    ) = review.saveNotes(caller.id, date, body)

    @PutMapping("/weeks/{date}/felt")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun rateWeek(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: Felt,
    ) = review.setWeekFelt(caller.id, date, body.felt)

    @PutMapping("/weeks/{date}/step")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reachReviewStep(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: ReviewStep,
    ) = review.setWeekStep(caller.id, date, body.step)

    @PostMapping("/weeks/{date}/finish")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun finishWeekReview(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
    ) = review.finishWeek(caller, date)

    @PostMapping("/weeks/{date}/outcomes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun createOutcome(
        caller: Caller,
        @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: OutcomeInput,
    ) = review.addOutcome(caller.id, date, body.title, body.priorityId)

    @PutMapping("/outcomes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateOutcome(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: OutcomeInput,
    ) = review.renameOutcome(caller.id, id, body.title, body.priorityId)

    @PutMapping("/outcomes/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateOutcomeStatus(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: OutcomeStatusInput,
    ) = review.setOutcomeStatus(caller.id, id, body.status)

    @DeleteMapping("/outcomes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeOutcome(
        caller: Caller,
        @PathVariable id: Long,
    ) = review.deleteOutcome(caller.id, id)

    /** The quarter the week of [date] falls in, or 204 when there is none. */
    @GetMapping("/quarter")
    fun quarter(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
    ): ResponseEntity<Quarter> =
        quarters.at(caller.id, date)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.noContent().build()

    @PostMapping("/quarters")
    fun createQuarter(
        caller: Caller,
        @RequestBody body: QuarterInput,
    ): Long = quarters.create(caller.id, body)

    @PutMapping("/quarters/{id}")
    fun updateQuarter(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: QuarterInput,
    ): Long = quarters.update(caller.id, id, body)

    @PostMapping("/quarters/{id}/priorities")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun createPriority(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: PriorityTitle,
    ) = quarters.addPriority(caller.id, id, body.title)

    @PutMapping("/priorities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updatePriority(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: PriorityInput,
    ) = quarters.editPriority(caller.id, id, body)

    @DeleteMapping("/priorities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removePriority(
        caller: Caller,
        @PathVariable id: Long,
    ) = quarters.deletePriority(caller.id, id)
}
