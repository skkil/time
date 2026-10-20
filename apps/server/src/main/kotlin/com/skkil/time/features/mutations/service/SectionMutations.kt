package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.sections.domain.SectionInput
import com.skkil.time.features.sections.service.SectionService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class SectionMutations(
    private val sections: SectionService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createSection", "projectId", "name", "before") { caller, args ->
                sections.create(
                    caller,
                    SectionInput(args.get<UUID?>("projectId"), args.get<String>("name"), args.get<UUID?>("before")),
                )
            },
            mutation("renameSection", "id", "name") { caller, args ->
                sections.rename(caller.id, args.get<UUID>("id"), args.get<String>("name"))
            },
            mutation("setSectionCollapsed", "id", "collapsed") { caller, args ->
                sections.setCollapsed(caller.id, args.get<UUID>("id"), args.get<Boolean>("collapsed"))
            },
            mutation("reorderSection", "id", "before") { caller, args ->
                sections.reorder(caller.id, args.get<UUID>("id"), args.get<UUID?>("before"))
            },
            mutation("deleteSection", "id") { caller, args ->
                sections.delete(caller.id, args.get<UUID>("id"))
            },
        )
}
