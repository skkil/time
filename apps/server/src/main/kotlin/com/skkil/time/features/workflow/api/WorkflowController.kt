package com.skkil.time.features.workflow.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.workflow.domain.ItemTypeInput
import com.skkil.time.features.workflow.domain.MilestoneInput
import com.skkil.time.features.workflow.domain.PRESETS
import com.skkil.time.features.workflow.domain.Preset
import com.skkil.time.features.workflow.domain.StatusInput
import com.skkil.time.features.workflow.domain.ViewInput
import com.skkil.time.features.workflow.domain.Workflow
import com.skkil.time.features.workflow.service.WorkflowService
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
import java.util.UUID

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
        @PathVariable id: UUID,
    ): Preset = workflow.exportPreset(caller.id, id)

    @PutMapping("/projects/{id}/preset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun applyPreset(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody preset: Preset,
    ) = workflow.applyPreset(caller, id, preset)

    @PostMapping("/projects/{id}/item-types")
    fun createType(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: ItemTypeInput,
    ): UUID = workflow.createType(caller, id, input)

    @PutMapping("/item-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateType(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: ItemTypeInput,
    ) = workflow.updateType(caller.id, id, input)

    @DeleteMapping("/item-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteType(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestParam(required = false) replacement: UUID?,
    ) = workflow.deleteType(caller.id, id, replacement)

    @PostMapping("/projects/{id}/item-statuses")
    fun createStatus(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: StatusInput,
    ): UUID = workflow.createStatus(caller, id, input)

    @PutMapping("/item-statuses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateStatus(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: StatusInput,
    ) = workflow.updateStatus(caller, id, input)

    @PutMapping("/item-statuses/{id}/position")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reorderStatus(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: StatusPlacement,
    ) = workflow.reorderStatus(caller.id, id, body.before)

    @DeleteMapping("/item-statuses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteStatus(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestParam(required = false) replacement: UUID?,
    ) = workflow.deleteStatus(caller, id, replacement)

    @PostMapping("/projects/{id}/milestones")
    fun createMilestone(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: MilestoneInput,
    ): UUID = workflow.createMilestone(caller, id, input)

    @PutMapping("/milestones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateMilestone(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: MilestoneInput,
    ) = workflow.updateMilestone(caller.id, id, input)

    @DeleteMapping("/milestones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteMilestone(
        caller: Caller,
        @PathVariable id: UUID,
    ) = workflow.deleteMilestone(caller.id, id)

    @PutMapping("/projects/{id}/milestone-label")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setMilestoneLabel(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: MilestoneLabel,
    ) = workflow.setMilestoneLabel(caller.id, id, body.label)

    @PostMapping("/projects/{id}/saved-views")
    fun createView(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: ViewInput,
    ): UUID = workflow.createView(caller, id, input)

    @PutMapping("/saved-views/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun updateView(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: ViewInput,
    ) = workflow.updateView(caller.id, id, input)

    @DeleteMapping("/saved-views/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteView(
        caller: Caller,
        @PathVariable id: UUID,
    ) = workflow.deleteView(caller.id, id)
}
