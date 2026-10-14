package com.skkil.time.features.tasks.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.domain.TaskInput
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.tasks.service.DependencyService
import com.skkil.time.features.tasks.service.TaskService
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
@RequestMapping("/api/v1/tasks")
class TaskController(private val tasks: TaskService, private val dependencies: DependencyService) {
    @GetMapping
    fun list(caller: Caller): List<Task> = tasks.list(caller)

    @GetMapping("/{id}")
    fun get(
        caller: Caller,
        @PathVariable id: Long,
    ): Task = tasks.get(caller.id, id)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody input: TaskInput,
    ): Task = tasks.create(caller, input)

    @PutMapping("/{id}")
    fun update(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody input: TaskInput,
    ): Task = tasks.update(caller.id, id, input)

    @PostMapping("/{id}/move")
    fun move(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody placement: TaskPlacement,
    ): Task = tasks.move(caller.id, id, placement)

    @PostMapping("/reschedule")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reschedule(
        caller: Caller,
        @RequestBody body: TaskReschedule,
    ) = tasks.reschedule(caller, body.ids, body.dueDate)

    @PutMapping("/{id}/completed")
    fun setCompleted(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskCompleted,
    ): Task = tasks.setCompleted(caller, id, body.completed)

    @PutMapping("/{id}/outcome")
    fun setOutcome(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskOutcome,
    ): Task = tasks.setOutcome(caller.id, id, body.outcomeId)

    @PostMapping("/someday")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun setSomeday(
        caller: Caller,
        @RequestBody body: TasksSomeday,
    ) = tasks.setSomeday(caller.id, body.ids, body.someday)

    @PutMapping("/{id}/must")
    fun setMust(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskMust,
    ): Task = tasks.setMust(caller.id, id, body.mustOn)

    @PutMapping("/{id}/next-step")
    fun setNextStep(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskNextStep,
    ): Task = tasks.setNextStep(caller.id, id, body.nextStep)

    @PostMapping("/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteMany(
        caller: Caller,
        @RequestBody body: TaskIds,
    ) = tasks.deleteMany(caller.id, body.ids)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: Long,
    ) = tasks.delete(caller.id, id)

    @PostMapping("/{id}/dependencies")
    fun addDependency(
        caller: Caller,
        @PathVariable id: Long,
        @RequestBody body: TaskDependency,
    ): Task = dependencies.add(caller.id, id, body.blockedById)

    @DeleteMapping("/{id}/dependencies/{blockedById}")
    fun removeDependency(
        caller: Caller,
        @PathVariable id: Long,
        @PathVariable blockedById: Long,
    ): Task = dependencies.remove(caller.id, id, blockedById)
}
