package com.skkil.time.features.realtime.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.realtime.domain.Ticket
import com.skkil.time.features.realtime.service.RealtimeTicketService
import com.skkil.time.features.realtime.websocket.REALTIME_PATH
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class RealtimeController(private val tickets: RealtimeTicketService) {
    /** A one-time ticket for `GET /api/v1/realtime?ticket=…` (websocket), valid for a minute. */
    @PostMapping("$REALTIME_PATH/tickets")
    fun issueTicket(caller: Caller): Ticket = tickets.issue(caller.id)
}
