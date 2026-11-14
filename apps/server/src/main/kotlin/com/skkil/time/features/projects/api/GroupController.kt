package com.skkil.time.features.projects.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.domain.Group
import com.skkil.time.features.projects.service.GroupService
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
@RequestMapping("/api/v1/groups")
class GroupController(private val groups: GroupService) {
    @GetMapping
    fun list(caller: Caller): List<Group> = groups.list(caller.id)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody body: GroupName,
    ): Group = groups.create(caller, body.name)

    @PutMapping("/{id}")
    fun rename(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: GroupName,
    ): Group =
        groups.rename(caller.id, id, body.name)

    @PutMapping("/{id}/position")
    fun reorder(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: ProjectPlacement,
    ): Group =
        groups.reorder(caller.id, id, body.before)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: UUID,
    ) = groups.delete(caller.id, id)
}
