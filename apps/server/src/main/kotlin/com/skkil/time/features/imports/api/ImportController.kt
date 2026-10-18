package com.skkil.time.features.imports.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.imports.domain.ImportProject
import com.skkil.time.features.imports.service.ImportService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/import")
class ImportController(private val imports: ImportService) {
    @PostMapping("/projects")
    fun importProjects(
        caller: Caller,
        @RequestBody projects: List<ImportProject>,
    ): List<UUID> = imports.import(caller, projects)
}
