package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.workflow.domain.ItemTypeInput
import com.skkil.time.features.workflow.domain.MilestoneInput
import com.skkil.time.features.workflow.domain.Preset
import com.skkil.time.features.workflow.domain.StatusInput
import com.skkil.time.features.workflow.domain.ViewInput
import com.skkil.time.features.workflow.service.TaskWorkflowService
import com.skkil.time.features.workflow.service.WorkflowService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class WorkflowMutations(
    private val workflow: WorkflowService,
    private val items: TaskWorkflowService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createItemType", "projectId", "input") { caller, args ->
                workflow.createType(caller, args.get<UUID>("projectId"), args.get<ItemTypeInput>("input"))
            },
            mutation("updateItemType", "id", "input") { caller, args ->
                workflow.updateType(caller.id, args.get<UUID>("id"), args.get<ItemTypeInput>("input"))
            },
            mutation("deleteItemType", "id", "replacement") { caller, args ->
                workflow.deleteType(caller.id, args.get<UUID>("id"), args.get<UUID?>("replacement"))
            },
            mutation("createItemStatus", "projectId", "input") { caller, args ->
                workflow.createStatus(caller, args.get<UUID>("projectId"), args.get<StatusInput>("input"))
            },
            mutation("updateItemStatus", "id", "input") { caller, args ->
                workflow.updateStatus(caller, args.get<UUID>("id"), args.get<StatusInput>("input"))
            },
            mutation("reorderItemStatus", "id", "before") { caller, args ->
                workflow.reorderStatus(caller.id, args.get<UUID>("id"), args.get<UUID?>("before"))
            },
            mutation("deleteItemStatus", "id", "replacement") { caller, args ->
                workflow.deleteStatus(caller, args.get<UUID>("id"), args.get<UUID?>("replacement"))
            },
            mutation("createProjectMilestone", "projectId", "input") { caller, args ->
                workflow.createMilestone(caller, args.get<UUID>("projectId"), args.get<MilestoneInput>("input"))
            },
            mutation("updateProjectMilestone", "id", "input") { caller, args ->
                workflow.updateMilestone(caller.id, args.get<UUID>("id"), args.get<MilestoneInput>("input"))
            },
            mutation("deleteProjectMilestone", "id") { caller, args ->
                workflow.deleteMilestone(caller.id, args.get<UUID>("id"))
            },
            mutation("setProjectMilestoneLabel", "id", "label") { caller, args ->
                workflow.setMilestoneLabel(caller.id, args.get<UUID>("id"), args.get<String>("label"))
            },
            mutation("createSavedView", "projectId", "input") { caller, args ->
                workflow.createView(caller, args.get<UUID>("projectId"), args.get<ViewInput>("input"))
            },
            mutation("updateSavedView", "id", "input") { caller, args ->
                workflow.updateView(caller.id, args.get<UUID>("id"), args.get<ViewInput>("input"))
            },
            mutation("deleteSavedView", "id") { caller, args ->
                workflow.deleteView(caller.id, args.get<UUID>("id"))
            },
            mutation("applyProjectPreset", "id", "preset") { caller, args ->
                workflow.applyPreset(caller, args.get<UUID>("id"), args.get<Preset>("preset"))
            },
            mutation("setTaskTypeId", "id", "typeId") { caller, args ->
                items.setType(caller, args.get<UUID>("id"), args.get<UUID?>("typeId"))
            },
            mutation("setTaskStatusId", "id", "statusId") { caller, args ->
                items.setStatus(caller, args.get<UUID>("id"), args.get<UUID>("statusId"))
            },
            mutation("setTaskMilestoneId", "id", "milestoneId") { caller, args ->
                items.setMilestone(caller.id, args.get<UUID>("id"), args.get<UUID?>("milestoneId"))
            },
            mutation("setTaskEventDetails", "id", "location", "countsAsTime") { caller, args ->
                items.setEventDetails(
                    caller.id,
                    args.get<UUID>("id"),
                    args.get<String>("location"),
                    args.get<Boolean>("countsAsTime"),
                )
            },
        )
}
