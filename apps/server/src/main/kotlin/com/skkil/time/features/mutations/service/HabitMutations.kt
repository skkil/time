package com.skkil.time.features.mutations.service

import com.skkil.time.features.habits.domain.HabitInput
import com.skkil.time.features.habits.domain.HabitMeasurement
import com.skkil.time.features.habits.domain.ManualStatus
import com.skkil.time.features.habits.service.HabitService
import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.util.UUID

@Component
class HabitMutations(
    private val habits: HabitService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createHabit", "input") { caller, args ->
                habits.create(caller, args.get<HabitInput>("input"))
            },
            mutation("updateHabit", "id", "input") { caller, args ->
                habits.update(caller, args.get<UUID>("id"), args.get<HabitInput>("input"))
            },
            mutation("archiveHabit", "id") { caller, args ->
                habits.archive(caller.id, args.get<UUID>("id"))
            },
            mutation("setHabitStatus", "habitId", "date", "status") { caller, args ->
                habits.setStatus(
                    caller,
                    args.get<UUID>("habitId"),
                    args.get<LocalDate>("date"),
                    args.get<ManualStatus?>("status"),
                )
            },
            mutation("addHabitValue", "habitId", "date", "delta") { caller, args ->
                habits.addValue(
                    caller,
                    args.get<UUID>("habitId"),
                    args.get<LocalDate>("date"),
                    args.get<Double?>("delta"),
                )
            },
            mutation("recordHabitMeasurements", "measurements") { caller, args ->
                habits.recordMeasurements(caller, args.get<List<HabitMeasurement>>("measurements"))
            },
        )
}
