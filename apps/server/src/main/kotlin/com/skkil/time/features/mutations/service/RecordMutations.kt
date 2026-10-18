package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.records.service.RecordService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class RecordMutations(
    private val records: RecordService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("setRecordPhaseNotes", "taskId", "statusId", "notes") { caller, args ->
                records.setNotes(
                    caller,
                    args.get<UUID>("taskId"),
                    args.get<UUID>("statusId"),
                    args.get<String>("notes"),
                )
            },
            mutation("setTaskPhase", "id", "phaseId") { caller, args ->
                records.setPhase(caller.id, args.get<UUID>("id"), args.get<UUID?>("phaseId"))
            },
            mutation("createPhaseTask", "recordId", "phaseId", "title") { caller, args ->
                records.createTask(
                    caller,
                    args.get<UUID>("recordId"),
                    args.get<UUID>("phaseId"),
                    args.get<String>("title"),
                )
            },
        )
}
