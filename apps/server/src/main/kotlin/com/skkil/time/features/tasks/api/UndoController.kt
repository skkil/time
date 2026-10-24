package com.skkil.time.features.tasks.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.sync.web.OwnWritePath
import com.skkil.time.features.tasks.domain.TaskSnapshot
import com.skkil.time.features.tasks.service.UndoService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/undo")
class UndoController(private val undo: UndoService) {
    /** Reads a snapshot of the tasks for the client to keep; nothing is stored. */
    @OwnWritePath
    @PostMapping("/capture")
    fun capture(
        caller: Caller,
        @RequestBody body: TaskIds,
    ): TaskSnapshot = undo.capture(caller, body.ids)

    @PostMapping("/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun restore(
        caller: Caller,
        @RequestBody snapshot: TaskSnapshot,
    ) = undo.restore(caller, snapshot)
}
