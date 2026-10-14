package com.skkil.time.features.realtime

import com.skkil.time.common.web.Caller
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class RealtimeController(private val tickets: RealtimeTickets) {
    /** A one-time ticket for `GET /api/v1/realtime?ticket=…` (websocket), valid for a minute. */
    @PostMapping("$REALTIME_PATH/tickets")
    fun issueTicket(caller: Caller): Ticket = tickets.issue(caller.id)
}
