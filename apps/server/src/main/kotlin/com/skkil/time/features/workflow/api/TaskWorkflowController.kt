package com.skkil.time.features.workflow.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.workflow.domain.EventOccurrence
import com.skkil.time.features.workflow.domain.TypeTime
import com.skkil.time.features.workflow.service.TaskWorkflowService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/api/v1")
class TaskWorkflowController(private val items: TaskWorkflowService) {
    @PutMapping("/tasks/{id}/type")
    fun setType(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskTypeId,
    ): Task = items.setType(caller, id, body.typeId)

    @PutMapping("/tasks/{id}/status")
    fun setStatus(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskStatusId,
    ): Task = items.setStatus(caller, id, body.statusId)

    @PutMapping("/tasks/{id}/milestone")
    fun setMilestone(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskMilestoneId,
    ): Task = items.setMilestone(caller.id, id, body.milestoneId)

    @PutMapping("/tasks/{id}/event-details")
    fun setEventDetails(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskEventDetails,
    ): Task = items.setEventDetails(caller.id, id, body.location, body.countsAsTime)

    @GetMapping("/events")
    fun events(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<EventOccurrence> = items.occurrences(caller, from, to)

    @GetMapping("/time-by-type")
    fun timeByType(
        caller: Caller,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): List<TypeTime> = items.timeByType(caller, from, to)
}
