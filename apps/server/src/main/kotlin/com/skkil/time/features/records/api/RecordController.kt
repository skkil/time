package com.skkil.time.features.records.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.records.domain.RecordPhase
import com.skkil.time.features.records.service.RecordService
import com.skkil.time.features.tasks.domain.Task
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/tasks")
class RecordController(private val records: RecordService) {
    @GetMapping("/{id}/phases")
    fun phases(
        caller: Caller,
        @PathVariable id: UUID,
    ): List<RecordPhase> = records.phases(caller.id, id)

    @PutMapping("/{id}/phases/{statusId}/notes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setNotes(
        caller: Caller,
        @PathVariable id: UUID,
        @PathVariable statusId: UUID,
        @RequestBody body: PhaseNotes,
    ) = records.setNotes(caller, id, statusId, body.notes)

    @PutMapping("/{id}/phase")
    fun setPhase(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: TaskPhase,
    ): Task = records.setPhase(caller.id, id, body.phaseId)

    @PostMapping("/{id}/phase-tasks")
    fun createTask(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: PhaseTaskInput,
    ): Task = records.createTask(caller, id, body.phaseId, body.title)
}
