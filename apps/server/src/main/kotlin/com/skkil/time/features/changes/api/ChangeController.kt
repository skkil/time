package com.skkil.time.features.changes.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.changes.domain.Changes
import com.skkil.time.features.changes.service.ChangeService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class ChangeController(private val changes: ChangeService) {
    @GetMapping("/api/v1/changes")
    fun changes(caller: Caller): Changes = changes.read(caller.id)
}
