package com.skkil.time.features.projects

import com.skkil.time.common.Caller
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

@RestController
@RequestMapping("/api/v1/projects")
class ProjectController(private val projects: ProjectService, private val canvas: CanvasService) {
    @GetMapping
    fun list(caller: Caller): List<Project> = projects.list(caller.id)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody input: ProjectInput,
    ): Project = projects.create(caller.id, input)

    @PutMapping("/{id}")
    fun update(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: ProjectInput,
    ): Project =
        projects.update(caller.id, id, input)

    @PutMapping("/{id}/archived")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setArchived(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: Archived,
    ) =
        projects.setArchived(caller.id, id, body.archived)

    @PutMapping("/{id}/view")
    fun setView(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: ProjectView,
    ): Project =
        projects.setView(caller.id, id, body.view)

    @PutMapping("/{id}/settings")
    fun updateSettings(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody settings: ProjectSettings,
    ): Project =
        projects.updateSettings(caller.id, id, settings)

    @PostMapping("/{id}/review")
    fun markReviewed(
        caller: Caller,
        @PathVariable id: Long,
    ): Project = projects.markReviewed(caller, id)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: Long,
    ) = projects.delete(caller.id, id)

    @GetMapping("/{id}/canvas")
    fun getCanvas(
        caller: Caller,
        @PathVariable id: Long,
    ): ProjectCanvas = canvas.get(caller.id, id)

    @PutMapping("/{id}/canvas")
    fun saveCanvas(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: CanvasContent,
    ): ProjectCanvas =
        canvas.save(caller, id, body.content)
}

@RestController
@RequestMapping("/api/v1/groups")
class GroupController(private val groups: GroupService) {
    @GetMapping
    fun list(caller: Caller): List<Group> = groups.list(caller.id)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody body: GroupName,
    ): Group = groups.create(caller.id, body.name)

    @PutMapping("/{id}")
    fun rename(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: GroupName,
    ): Group =
        groups.rename(caller.id, id, body.name)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: Long,
    ) = groups.delete(caller.id, id)
}
