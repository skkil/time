package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.projects.domain.ProjectSettings
import com.skkil.time.features.projects.service.CanvasService
import com.skkil.time.features.projects.service.GroupService
import com.skkil.time.features.projects.service.ProjectService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class ProjectMutations(
    private val projects: ProjectService,
    private val groups: GroupService,
    private val canvas: CanvasService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createProject", "input") { caller, args ->
                projects.create(caller, args.get<ProjectInput>("input"))
            },
            mutation("updateProject", "id", "input") { caller, args ->
                projects.update(caller.id, args.get<UUID>("id"), args.get<ProjectInput>("input"))
            },
            mutation("setProjectArchived", "id", "archived") { caller, args ->
                projects.setArchived(caller.id, args.get<UUID>("id"), args.get<Boolean>("archived"))
            },
            mutation("setProjectView", "id", "view") { caller, args ->
                projects.setView(caller.id, args.get<UUID>("id"), args.get<String>("view"))
            },
            mutation("updateProjectSettings", "id", "settings") { caller, args ->
                projects.updateSettings(caller.id, args.get<UUID>("id"), args.get<ProjectSettings>("settings"))
            },
            mutation("markProjectReviewed", "id") { caller, args ->
                projects.markReviewed(caller, args.get<UUID>("id"))
            },
            mutation("reorderProject", "id", "before") { caller, args ->
                projects.reorder(caller.id, args.get<UUID>("id"), args.get<UUID?>("before"))
            },
            mutation("deleteProject", "id") { caller, args ->
                projects.delete(caller.id, args.get<UUID>("id"))
            },
            mutation("createGroup", "name") { caller, args ->
                groups.create(caller, args.get<String>("name"))
            },
            mutation("renameGroup", "id", "name") { caller, args ->
                groups.rename(caller.id, args.get<UUID>("id"), args.get<String>("name"))
            },
            mutation("reorderGroup", "id", "before") { caller, args ->
                groups.reorder(caller.id, args.get<UUID>("id"), args.get<UUID?>("before"))
            },
            mutation("deleteGroup", "id") { caller, args ->
                groups.delete(caller.id, args.get<UUID>("id"))
            },
            mutation("saveProjectCanvas", "projectId", "content") { caller, args ->
                canvas.save(caller, args.get<UUID>("projectId"), args.get<String>("content"))
            },
        )
}
