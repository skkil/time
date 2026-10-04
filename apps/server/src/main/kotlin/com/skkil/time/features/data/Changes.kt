package com.skkil.time.features.data

import com.skkil.time.auth.CALLER_ID_ATTRIBUTE
import com.skkil.time.auth.CLIENT_ID_HEADER
import com.skkil.time.common.Caller
import com.skkil.time.features.realtime.ChangeEvent
import com.skkil.time.features.realtime.RealtimeBus
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.filter.OncePerRequestFilter

data class Changes(val version: Long, val lastWriter: String?)

/**
 * Counts each user's successful writes and announces them on the realtime bus, so other devices and tabs refetch
 * at once. `GET /api/v1/changes` stays as the polling fallback.
 */
@Component
class ChangeTracking(private val jdbc: JdbcClient, private val bus: RealtimeBus) : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest) =
        !request.requestURI.startsWith(API) ||
            request.method !in WRITES ||
            UNTRACKED.any { request.requestURI.startsWith(it) }

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        chain.doFilter(request, response)
        val user = request.getAttribute(CALLER_ID_ATTRIBUTE) as? Long ?: return
        if (response.status !in 200..299) return
        val writer = request.getHeader(CLIENT_ID_HEADER)?.take(MAX_CLIENT_ID)
        val version =
            jdbc
                .sql(
                    "UPDATE app_user SET data_version = data_version + 1, last_writer = :writer " +
                        "WHERE id = :id RETURNING data_version",
                ).param("writer", writer)
                .param("id", user)
                .query(Long::class.java)
                .optional()
                .orElse(null) ?: return
        val topic = request.requestURI.removePrefix(API).substringBefore('/')
        bus.publish(user, ChangeEvent("changed", version, writer, topic))
    }

    fun read(user: Long): Changes =
        jdbc
            .sql("SELECT data_version, last_writer FROM app_user WHERE id = :id")
            .param("id", user)
            .query { rs, _ -> Changes(rs.getLong("data_version"), rs.getString("last_writer")) }
            .single()

    private companion object {
        const val API = "/api/v1/"
        val WRITES = setOf("POST", "PUT", "PATCH", "DELETE")
        val UNTRACKED = listOf("/api/v1/realtime", "/api/v1/notifications")
        const val MAX_CLIENT_ID = 100
    }
}

@RestController
class ChangeController(private val changes: ChangeTracking) {
    @GetMapping("/api/v1/changes")
    fun changes(caller: Caller): Changes = changes.read(caller.id)
}
