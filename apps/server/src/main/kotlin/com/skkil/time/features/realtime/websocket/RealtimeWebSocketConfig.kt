package com.skkil.time.features.realtime.websocket

import com.skkil.time.config.AppProperties
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry

@Configuration
@EnableWebSocket
@EnableScheduling
class RealtimeWebSocketConfig(
    private val handler: RealtimeWebSocketHandler,
    private val handshake: TicketHandshakeInterceptor,
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
