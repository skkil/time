package com.skkil.time.features.data.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.data.domain.DataExport
import com.skkil.time.features.data.service.DataService
import com.skkil.time.features.sync.web.OwnWritePath
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/data")
class DataController(private val data: DataService) {
    @GetMapping("/export")
    fun export(caller: Caller): DataExport = data.export(caller)

    /**
     * Takes the export document as raw JSON text, so a malformed file is refused like any other bad backup. The
     * restore opens the write path itself, since it starts the scope over once the rows are in.
     */
    @PostMapping("/import")
    @OwnWritePath
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun import(
        caller: Caller,
        @RequestBody text: String,
    ) = data.restore(caller, text)

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteAll(caller: Caller) = data.deleteAll(caller)
}
