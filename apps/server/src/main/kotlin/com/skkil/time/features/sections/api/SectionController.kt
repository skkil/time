package com.skkil.time.features.sections.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.sections.domain.Section
import com.skkil.time.features.sections.domain.SectionInput
import com.skkil.time.features.sections.service.SectionService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
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
@RequestMapping("/api/v1/sections")
class SectionController(private val sections: SectionService) {
    @GetMapping
    fun list(caller: Caller): List<Section> = sections.list(caller.id)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody input: SectionInput,
    ): Section = sections.create(caller, input)

    @PutMapping("/{id}/name")
    fun rename(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: SectionName,
    ): Section =
        sections.rename(caller.id, id, body.name)

    @PutMapping("/{id}/collapsed")
    fun setCollapsed(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: SectionCollapsed,
    ): Section =
        sections.setCollapsed(caller.id, id, body.collapsed)

    @PutMapping("/{id}/position")
    fun reorder(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: SectionPlacement,
    ): Section =
        sections.reorder(caller.id, id, body.before)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: UUID,
    ) = sections.delete(caller.id, id)
}
