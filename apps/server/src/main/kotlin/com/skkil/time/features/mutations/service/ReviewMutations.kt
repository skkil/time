package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.review.domain.OutcomeStatus
import com.skkil.time.features.review.domain.PriorityInput
import com.skkil.time.features.review.domain.QuarterInput
import com.skkil.time.features.review.domain.WeekNotes
import com.skkil.time.features.review.service.QuarterService
import com.skkil.time.features.review.service.ReviewService
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.util.UUID

@Component
class ReviewMutations(
    private val review: ReviewService,
    private val quarters: QuarterService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("rateDay", "date", "felt") { caller, args ->
                review.setDayFelt(caller, args.get<LocalDate>("date"), args.get<Int>("felt"))
            },
            mutation("saveDayNote", "date", "note") { caller, args ->
                review.setDayNote(caller, args.get<LocalDate>("date"), args.get<String>("note"))
            },
            mutation("skipDayCheckIn", "date") { caller, args ->
                review.skipDay(caller, args.get<LocalDate>("date"))
            },
            mutation("saveWeekNotes", "date", "notes") { caller, args ->
                review.saveNotes(caller, args.get<LocalDate>("date"), args.get<WeekNotes>("notes"))
            },
            mutation("rateWeek", "date", "felt") { caller, args ->
                review.setWeekFelt(caller, args.get<LocalDate>("date"), args.get<Int>("felt"))
            },
            mutation("reachReviewStep", "date", "step") { caller, args ->
                review.setWeekStep(caller, args.get<LocalDate>("date"), args.get<Int>("step"))
            },
            mutation("finishWeekReview", "date") { caller, args ->
                review.finishWeek(caller, args.get<LocalDate>("date"))
            },
            mutation("createOutcome", "date", "title", "priorityId") { caller, args ->
                review.addOutcome(
                    caller,
                    args.get<LocalDate>("date"),
                    args.get<String>("title"),
                    args.get<UUID?>("priorityId"),
                )
            },
            mutation("updateOutcome", "id", "title", "priorityId") { caller, args ->
                review.renameOutcome(
                    caller.id,
                    args.get<UUID>("id"),
                    args.get<String>("title"),
                    args.get<UUID?>("priorityId"),
                )
            },
            mutation("updateOutcomeStatus", "id", "status") { caller, args ->
                review.setOutcomeStatus(caller, args.get<UUID>("id"), args.get<OutcomeStatus>("status"))
            },
            mutation("removeOutcome", "id") { caller, args ->
                review.deleteOutcome(caller.id, args.get<UUID>("id"))
            },
            mutation("upsertQuarter", "id", "label", "startDate") { caller, args ->
                val input = QuarterInput(args.get<String>("label"), args.get<LocalDate>("startDate"))
                args.get<UUID?>("id")?.let { quarters.update(caller.id, it, input) } ?: quarters.create(caller, input)
            },
            mutation("createPriority", "quarterId", "title") { caller, args ->
                quarters.addPriority(caller, args.get<UUID>("quarterId"), args.get<String>("title"))
            },
            mutation("updatePriority", "id", "title", "note") { caller, args ->
                quarters.editPriority(
                    caller.id,
                    args.get<UUID>("id"),
                    PriorityInput(args.get<String>("title"), args.get<String>("note")),
                )
            },
            mutation("removePriority", "id") { caller, args ->
                quarters.deletePriority(caller.id, args.get<UUID>("id"))
            },
        )
}
