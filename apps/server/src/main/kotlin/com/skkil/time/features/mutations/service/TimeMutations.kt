package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.time.domain.BlockSpan
import com.skkil.time.features.time.domain.EntryDetails
import com.skkil.time.features.time.domain.EntryInput
import com.skkil.time.features.time.domain.RunningTimer
import com.skkil.time.features.time.service.BlockService
import com.skkil.time.features.time.service.EntryService
import com.skkil.time.features.time.service.TimerService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class TimeMutations(
    private val blocks: BlockService,
    private val entries: EntryService,
    private val timer: TimerService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createBlock", "taskId", "span") { caller, args ->
                blocks.create(caller, args.get<UUID>("taskId"), args.get<BlockSpan>("span"))
            },
            mutation("rescheduleBlock", "id", "span") { caller, args ->
                blocks.reschedule(caller.id, args.get<UUID>("id"), args.get<BlockSpan>("span"))
            },
            mutation("deleteBlock", "id") { caller, args ->
                blocks.delete(caller.id, args.get<UUID>("id"))
            },
            mutation("createTimeEntry", "input") { caller, args ->
                entries.create(caller, args.get<EntryInput>("input"))
            },
            mutation("updateTimeEntry", "id", "input") { caller, args ->
                entries.update(caller, args.get<UUID>("id"), args.get<EntryInput>("input"))
            },
            mutation("deleteTimeEntry", "id") { caller, args ->
                entries.delete(caller.id, args.get<UUID>("id"))
            },
            mutation("startTimer", "details") { caller, args ->
                timer.start(caller, args.get<EntryDetails>("details"))
            },
            mutation("editTimer", "details") { caller, args ->
                timer.edit(caller, args.get<EntryDetails>("details"))
            },
            mutation("stopTimer") { caller, args ->
                timer.stop(caller)
            },
            mutation("pauseTimer") { caller, args ->
                timer.pause(caller)
            },
            mutation("resumeTimer") { caller, args ->
                timer.resume(caller)
            },
            mutation("discardTimer") { caller, args ->
                timer.discard(caller.id)
            },
            mutation("restoreTimer", "timer") { caller, args ->
                timer.restore(caller, args.get<RunningTimer>("timer"))
            },
        )
}
