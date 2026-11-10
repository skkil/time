package com.skkil.time.features.mutations.service

import com.skkil.time.features.calendar.service.CalendarService
import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class CalendarMutations(private val calendars: CalendarService) : MutationSet {
    override val mutations =
        listOf(
            mutation("setCalendarSourceVisible", "id", "visible") { caller, args ->
                calendars.setVisible(caller, args.get<UUID>("id"), args.get<Boolean>("visible"))
            },
        )
}
