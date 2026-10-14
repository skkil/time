package com.skkil.time.features.workflow

import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.Task
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

@RestController
@RequestMapping("/api/v1")
class WorkflowController(private val workflow: WorkflowService) {
    @GetMapping("/workflow")
    fun get(caller: Caller): Workflow = workflow.list(caller.id)

    @GetMapping("/presets")
    fun presets(): List<Preset> = PRESETS

    @PostMapping("/presets/read")
    fun readPreset(
        @RequestBody body: PresetText,
    ): Preset = workflow.parsePreset(body.text)

    @GetMapping("/projects/{id}/preset")
    fun exportPreset(
        caller: Caller,
        @PathVariable id: Long,
    ): Preset = workflow.exportPreset(caller.id, id)

    @PutMapping("/projects/{id}/preset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun applyPreset(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody preset: Preset,
    ) = workflow.applyPreset(caller.id, id, preset)

    @PostMapping("/projects/{id}/item-types")
    fun createType(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: ItemTypeInput,
    ): Long = workflow.createType(caller.id, id, input)

    @PutMapping("/item-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateType(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: ItemTypeInput,
    ) = workflow.updateType(caller.id, id, input)

    @DeleteMapping("/item-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteType(
        caller: Caller,
        @PathVariable id: Long,
        @RequestParam(required = false) replacement: Long?,
    ) = workflow.deleteType(caller.id, id, replacement)

    @PostMapping("/projects/{id}/item-statuses")
    fun createStatus(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: StatusInput,
    ): Long = workflow.createStatus(caller.id, id, input)

    @PutMapping("/item-statuses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateStatus(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: StatusInput,
    ) = workflow.updateStatus(caller, id, input)

    @PutMapping("/item-statuses/{id}/position")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reorderStatus(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: StatusPlacement,
    ) = workflow.reorderStatus(caller.id, id, body.before)

    @DeleteMapping("/item-statuses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteStatus(
        caller: Caller,
        @PathVariable id: Long,
        @RequestParam(required = false) replacement: Long?,
    ) = workflow.deleteStatus(caller, id, replacement)

    @PostMapping("/projects/{id}/milestones")
    fun createMilestone(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: MilestoneInput,
    ): Long = workflow.createMilestone(caller.id, id, input)

    @PutMapping("/milestones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateMilestone(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: MilestoneInput,
    ) = workflow.updateMilestone(caller.id, id, input)

    @DeleteMapping("/milestones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteMilestone(
        caller: Caller,
        @PathVariable id: Long,
    ) = workflow.deleteMilestone(caller.id, id)

    @PutMapping("/projects/{id}/milestone-label")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setMilestoneLabel(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: MilestoneLabel,
    ) = workflow.setMilestoneLabel(caller.id, id, body.label)

    @PostMapping("/projects/{id}/saved-views")
    fun createView(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: ViewInput,
    ): Long = workflow.createView(caller.id, id, input)

    @PutMapping("/saved-views/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateView(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: ViewInput,
    ) = workflow.updateView(caller.id, id, input)

    @DeleteMapping("/saved-views/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteView(
        caller: Caller,
        @PathVariable id: Long,
    ) = workflow.deleteView(caller.id, id)
}

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
