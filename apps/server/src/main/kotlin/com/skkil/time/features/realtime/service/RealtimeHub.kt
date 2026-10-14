package com.skkil.time.features.realtime.service

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.socket.PingMessage
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator
import java.util.concurrent.ConcurrentHashMap

/** The websocket sessions connected to this instance, by user. */
@Component
class RealtimeHub {
    private val log = LoggerFactory.getLogger(javaClass)
    private val sessions = ConcurrentHashMap<Long, MutableSet<WebSocketSession>>()

    fun join(user: Long, session: WebSocketSession): WebSocketSession {
        val safe = ConcurrentWebSocketSessionDecorator(session, SEND_TIMEOUT_MS, BUFFER_BYTES)
        sessions.computeIfAbsent(user) { ConcurrentHashMap.newKeySet() }.add(safe)
        return safe
    }

    fun leave(user: Long, session: WebSocketSession) {
        sessions.computeIfPresent(user) { _, set ->
            set.removeIf { it.id == session.id }
            set.ifEmpty { null }
        }
    }

    fun deliver(user: Long, payload: String) {
        sessions[user]?.forEach { session -> send(session) { it.sendMessage(TextMessage(payload)) } }
    }

    @Scheduled(fixedRate = 25_000)
    fun heartbeat() {
        sessions.values.forEach { set -> set.forEach { session -> send(session) { it.sendMessage(PingMessage()) } } }
    }

    fun connected(): Int = sessions.values.sumOf { it.size }

    private fun send(session: WebSocketSession, action: (WebSocketSession) -> Unit) {
        runCatching { if (session.isOpen) action(session) }
            .onFailure { log.debug("Dropping realtime message for session {}", session.id, it) }
    }

    private companion object {
        const val SEND_TIMEOUT_MS = 5_000
        const val BUFFER_BYTES = 64 * 1024
    }
}
