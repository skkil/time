package com.skkil.time.features.realtime.websocket

import com.skkil.time.features.realtime.service.RealtimeTicketService
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor

@Component
class TicketHandshakeInterceptor(private val tickets: RealtimeTicketService) : HandshakeInterceptor {
    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val ticket = (request as? ServletServerHttpRequest)?.servletRequest?.getParameter("ticket") ?: return false
        val user = tickets.redeem(ticket) ?: return false
        attributes[USER_ATTRIBUTE] = user
        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) = Unit
}

internal const val USER_ATTRIBUTE = "realtime.user"
