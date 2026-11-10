package com.skkil.time.features.tasks.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.domain.MoveResult
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.domain.TaskInput
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.tasks.service.DependencyService
import com.skkil.time.features.tasks.service.TaskMoveService
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
import java.util.UUID

@RestController
@RequestMapping("/api/v1/tasks")
class TaskController(
    private val tasks: TaskService,
    private val moves: TaskMoveService,
    private val dependencies: DependencyService,
) {
    @GetMapping
    fun list(caller: Caller): List<Task> = tasks.list(caller)

    @GetMapping("/{id}")
    fun get(
        caller: Caller,
        @PathVariable id: UUID,
    ): Task = tasks.get(caller.id, id)

    @PostMapping
    fun create(
        caller: Caller,
        @RequestBody input: TaskInput,
    ): Task = tasks.create(caller, input)

    @PutMapping("/{id}")
    fun update(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody input: TaskInput,
    ): Task = tasks.update(caller.id, id, input)

    @PostMapping("/{id}/move")
    fun move(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody placement: TaskPlacement,
    ): Task = tasks.move(caller.id, id, placement)

    @PostMapping("/reschedule")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun reschedule(
        caller: Caller,
        @RequestBody body: TaskReschedule,
    ) = tasks.reschedule(caller, body.ids, body.dueDate)

    @PostMapping("/move")
    fun moveMany(
        caller: Caller,
        @RequestBody body: TasksMove,
    ): MoveResult = moves.move(caller, body.ids, body.target, body.blocks)

    @PutMapping("/{id}/completed")
    fun setCompleted(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: TaskCompleted,
    ): Task = tasks.setCompleted(caller, id, body.completed)

    @PutMapping("/{id}/outcome")
    fun setOutcome(
        caller: Caller,
        @PathVariable id: UUID,
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
        @PathVariable id: UUID,
        @RequestBody body: TaskMust,
    ): Task = tasks.setMust(caller.id, id, body.mustOn)

    @PutMapping("/{id}/next-step")
    fun setNextStep(
        caller: Caller,
        @PathVariable id: UUID,
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
        @PathVariable id: UUID,
    ) = tasks.delete(caller.id, id)

    @PostMapping("/{id}/dependencies")
    fun addDependency(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: TaskDependency,
    ): Task = dependencies.add(caller, id, body.blockedById)

    @DeleteMapping("/{id}/dependencies/{blockedById}")
    fun removeDependency(
        caller: Caller,
        @PathVariable id: UUID,
        @PathVariable blockedById: UUID,
    ): Task = dependencies.remove(caller.id, id, blockedById)
}
