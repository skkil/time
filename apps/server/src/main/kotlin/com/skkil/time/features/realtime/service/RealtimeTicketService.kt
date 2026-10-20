package com.skkil.time.features.realtime.service

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.features.realtime.domain.Ticket
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.util.Base64

/**
 * One-time, short-lived tickets that authenticate a websocket handshake, so bearer tokens never travel in a URL.
 * They live in Postgres because the handshake may reach a different instance than the one that issued the ticket.
 */
@Service
class RealtimeTicketService(private val jdbc: JdbcClient, private val clock: MutationClock) {
    private val random = SecureRandom()

    fun issue(user: Long): Ticket {
        val bytes = ByteArray(32).also(random::nextBytes)
        val ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        jdbc
            .sql("INSERT INTO realtime_ticket (ticket, user_id, expires_at) VALUES (:ticket, :user, :expires)")
            .param("ticket", ticket)
            .param("user", user)
            .param("expires", clock.now().epochSecond + TTL_SECONDS)
            .update()
        return Ticket(ticket, TTL_SECONDS)
    }

    fun redeem(ticket: String): Long? =
        jdbc
            .sql("DELETE FROM realtime_ticket WHERE ticket = :ticket AND expires_at > :now RETURNING user_id")
            .param("ticket", ticket)
            .param("now", clock.now().epochSecond)
            .query(Long::class.java)
            .optional()
            .orElse(null)

    @Scheduled(fixedDelay = 300_000)
    fun sweep() {
        jdbc
            .sql("DELETE FROM realtime_ticket WHERE expires_at <= :now")
            .param("now", clock.now().epochSecond)
            .update()
    }

    private companion object {
        const val TTL_SECONDS = 60L
    }
}
