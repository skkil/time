package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.tasks.domain.MoveTarget
import com.skkil.time.features.tasks.domain.TaskInput
import com.skkil.time.features.tasks.domain.TaskPlacement
import com.skkil.time.features.tasks.domain.TaskSnapshot
import com.skkil.time.features.tasks.service.DependencyService
import com.skkil.time.features.tasks.service.TaskMoveService
import com.skkil.time.features.tasks.service.TaskService
import com.skkil.time.features.tasks.service.UndoService
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.util.UUID

@Component
class TaskMutations(
    private val tasks: TaskService,
    private val moves: TaskMoveService,
    private val dependencies: DependencyService,
    private val undo: UndoService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createTask", "input") { caller, args ->
                tasks.create(caller, args.get<TaskInput>("input"))
            },
            mutation("updateTask", "id", "input") { caller, args ->
                tasks.update(caller.id, args.get<UUID>("id"), args.get<TaskInput>("input"))
            },
            mutation("moveTask", "id", "placement") { caller, args ->
                tasks.move(caller.id, args.get<UUID>("id"), args.get<TaskPlacement>("placement"))
            },
            mutation("rescheduleTasks", "ids", "dueDate") { caller, args ->
                tasks.reschedule(caller, args.get<List<UUID>>("ids"), args.get<LocalDate?>("dueDate"))
            },
            mutation("moveTasks", "ids", "target", "blocks") { caller, args ->
                moves.move(
                    caller,
                    args.get<List<UUID>>("ids"),
                    args.get<MoveTarget>("target"),
                    args.get<String?>("blocks"),
                )
            },
            mutation("setTaskCompleted", "id", "completed") { caller, args ->
                tasks.setCompleted(caller, args.get<UUID>("id"), args.get<Boolean>("completed"))
            },
            mutation("setTaskOutcome", "id", "outcomeId") { caller, args ->
                tasks.setOutcome(caller.id, args.get<UUID>("id"), args.get<UUID?>("outcomeId"))
            },
            mutation("setTasksSomeday", "ids", "someday") { caller, args ->
                tasks.setSomeday(caller.id, args.get<List<UUID>>("ids"), args.get<Boolean>("someday"))
            },
            mutation("setTaskMust", "id", "mustOn") { caller, args ->
                tasks.setMust(caller.id, args.get<UUID>("id"), args.get<LocalDate?>("mustOn"))
            },
            mutation("setTaskNextStep", "id", "nextStep") { caller, args ->
                tasks.setNextStep(caller.id, args.get<UUID>("id"), args.get<String>("nextStep"))
            },
            mutation("deleteTasks", "ids") { caller, args ->
                tasks.deleteMany(caller.id, args.get<List<UUID>>("ids"))
            },
            mutation("deleteTask", "id") { caller, args ->
                tasks.delete(caller.id, args.get<UUID>("id"))
            },
            mutation("restoreTasks", "snapshot") { caller, args ->
                undo.restore(caller, args.get<TaskSnapshot>("snapshot"))
            },
            mutation("addTaskDependency", "taskId", "blockedById") { caller, args ->
                dependencies.add(caller, args.get<UUID>("taskId"), args.get<UUID>("blockedById"))
            },
            mutation("removeTaskDependency", "taskId", "blockedById") { caller, args ->
                dependencies.remove(caller.id, args.get<UUID>("taskId"), args.get<UUID>("blockedById"))
            },
        )
}
