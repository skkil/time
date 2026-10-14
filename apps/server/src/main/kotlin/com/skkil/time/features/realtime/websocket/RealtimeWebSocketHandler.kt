package com.skkil.time.features.realtime.websocket

import com.skkil.time.features.realtime.service.RealtimeHub
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

@Component
class RealtimeWebSocketHandler(private val hub: RealtimeHub) : TextWebSocketHandler() {
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
