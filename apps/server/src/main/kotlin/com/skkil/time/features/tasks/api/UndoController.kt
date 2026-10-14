package com.skkil.time.features.tasks.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.service.UndoService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/undo-snapshots")
class UndoController(private val undo: UndoService) {
    @PostMapping
    fun capture(
        caller: Caller,
        @RequestBody body: TaskIds,
    ): Long = undo.capture(caller, body.ids)

    @PostMapping("/{id}/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun restore(
        caller: Caller,
        @PathVariable id: Long,
    ) = undo.restore(caller.id, id)
}
