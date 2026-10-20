package com.skkil.time.features.rituals.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.rituals.domain.Moment
import com.skkil.time.features.rituals.domain.Ritual
import com.skkil.time.features.rituals.domain.RitualEvent
import com.skkil.time.features.rituals.domain.RitualInput
import com.skkil.time.features.rituals.domain.RitualRun
import com.skkil.time.features.rituals.service.RitualService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.util.UUID

@RestController
@RequestMapping("/api/v1")
class RitualController(private val rituals: RitualService) {
    @GetMapping("/rituals")
    fun list(caller: Caller): List<Ritual> = rituals.list(caller.id)

    @PutMapping("/rituals/{kind}")
    fun update(
        caller: Caller,
        @PathVariable kind: String,
        @RequestBody body: RitualInput,
    ): Ritual = rituals.update(caller.id, kind, body)

    @GetMapping("/planning-time")
    fun planningTime(caller: Caller): PlanningTime = PlanningTime(rituals.planningTime(caller.id))

    @PutMapping("/planning-time")
    fun choosePlanningTime(
        caller: Caller,
        @RequestBody body: PlanningChoice,
    ): List<Ritual> = rituals.setPlanningTime(caller, body.time)

    /** The ritual that should open for [event] right now in the caller's zone, or 204 when none is due. */
    @PostMapping("/rituals/due")
    fun due(
        caller: Caller,
        @RequestBody event: RitualEvent,
    ): ResponseEntity<Ritual> =
        rituals.due(caller, Moment.now(caller), event)?.let { ResponseEntity.ok(it) }
            ?: ResponseEntity.noContent().build()

    @GetMapping("/ritual-runs")
    fun runs(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<RitualRun> = rituals.runs(caller.id, from, to)

    @PostMapping("/rituals/{kind}/runs")
    fun start(
        caller: Caller,
        @PathVariable kind: String,
        @RequestBody body: RitualTask,
    ): RitualRun = rituals.start(caller, kind, Moment.now(caller), body.taskId)

    @PutMapping("/ritual-runs/{id}/step")
    fun reachStep(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: RitualStep,
    ): RitualRun = rituals.reachStep(caller.id, id, body.step)

    @PostMapping("/ritual-runs/{id}/finish")
    fun finish(
        caller: Caller,
        @PathVariable id: UUID,
    ): RitualRun = rituals.finish(caller.id, id, caller.now())

    @PostMapping("/ritual-runs/{id}/skip")
    fun skip(
        caller: Caller,
        @PathVariable id: UUID,
    ): RitualRun = rituals.skip(caller.id, id)

    @PostMapping("/ritual-runs/{id}/snooze")
    fun snooze(
        caller: Caller,
        @PathVariable id: UUID,
    ): RitualRun = rituals.snooze(caller.id, id, caller.now())
}
