package com.skkil.time.features.realtime

import com.skkil.time.config.AppProperties
import org.springframework.context.annotation.Configuration
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.http.server.ServletServerHttpRequest
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor

@Component
class RealtimeHandler(private val hub: RealtimeHub) : TextWebSocketHandler() {
    override fun afterConnectionEstablished(session: WebSocketSession) {
        hub.join(session.user, session)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        hub.leave(session.user, session)
    }

    override fun handleTransportError(session: WebSocketSession, exception: Throwable) {
        hub.leave(session.user, session)
    }

    private val WebSocketSession.user get() = attributes[USER_ATTRIBUTE] as Long
}

@Component
class TicketHandshake(private val tickets: RealtimeTickets) : HandshakeInterceptor {
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

@Configuration
@EnableWebSocket
@EnableScheduling
class RealtimeConfig(
    private val handler: RealtimeHandler,
    private val handshake: TicketHandshake,
    private val properties: AppProperties,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry
            .addHandler(handler, REALTIME_PATH)
            .addInterceptors(handshake)
            .setAllowedOrigins(*properties.cors.allowedOrigins.toTypedArray())
    }
}

const val REALTIME_PATH = "/api/v1/realtime"
private const val USER_ATTRIBUTE = "realtime.user"
