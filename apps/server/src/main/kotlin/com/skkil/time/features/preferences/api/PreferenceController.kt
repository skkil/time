package com.skkil.time.features.preferences.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.preferences.service.PreferenceService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/preferences")
class PreferenceController(private val preferences: PreferenceService) {
    @GetMapping
    fun readPreferences(caller: Caller): Map<String, Any?> = preferences.read(caller.id)

    @PatchMapping
    fun mergePreferences(
        caller: Caller,
        @RequestBody changes: Map<String, Any?>,
    ): Map<String, Any?> =
        preferences.merge(caller, changes)
}
