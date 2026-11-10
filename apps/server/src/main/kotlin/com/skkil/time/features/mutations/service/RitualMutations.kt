package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.rituals.domain.Moment
import com.skkil.time.features.rituals.domain.RitualInput
import com.skkil.time.features.rituals.service.RitualService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class RitualMutations(
    private val rituals: RitualService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("updateRitual", "kind", "input") { caller, args ->
                rituals.update(caller.id, args.get<String>("kind"), args.get<RitualInput>("input"))
            },
            mutation("choosePlanningTime", "time") { caller, args ->
                rituals.setPlanningTime(caller, args.get<String>("time"))
            },
            mutation("setReviewDay", "day") { caller, args ->
                rituals.setReviewDay(caller, args.get<Int>("day"))
            },
            mutation("startRitual", "kind", "taskId") { caller, args ->
                rituals.start(caller, args.get<String>("kind"), Moment.now(caller), args.get<UUID?>("taskId"))
            },
            mutation("reachRitualStep", "id", "step") { caller, args ->
                rituals.reachStep(caller.id, args.get<UUID>("id"), args.get<Int>("step"))
            },
            mutation("finishRitual", "id") { caller, args ->
                rituals.finish(caller.id, args.get<UUID>("id"), caller.now())
            },
            mutation("skipRitual", "id") { caller, args ->
                rituals.skip(caller.id, args.get<UUID>("id"))
            },
            mutation("snoozeRitual", "id") { caller, args ->
                rituals.snooze(caller.id, args.get<UUID>("id"), caller.now())
            },
        )
}
