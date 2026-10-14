package com.skkil.time.features.changes.web

import com.skkil.time.features.changes.service.ChangeService
import com.skkil.time.security.CALLER_ID_ATTRIBUTE
import com.skkil.time.security.CLIENT_ID_HEADER
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Counts each user's successful writes and announces them on the realtime bus, so other devices and tabs refetch
 * at once. `GET /api/v1/changes` stays as the polling fallback.
 */
@Component
class ChangeTrackingFilter(private val changes: ChangeService) : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest) =
        !request.requestURI.startsWith(API) ||
            request.method !in WRITES ||
            UNTRACKED.any { request.requestURI.startsWith(it) }

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        chain.doFilter(request, response)
        val user = request.getAttribute(CALLER_ID_ATTRIBUTE) as? Long ?: return
        if (response.status !in 200..299) return
        val writer = request.getHeader(CLIENT_ID_HEADER)?.take(MAX_CLIENT_ID)
        val topic = request.requestURI.removePrefix(API).substringBefore('/')
        changes.record(user, writer, topic)
    }

    private companion object {
        const val API = "/api/v1/"
        val WRITES = setOf("POST", "PUT", "PATCH", "DELETE")
        val UNTRACKED = listOf("/api/v1/realtime", "/api/v1/notifications")
        const val MAX_CLIENT_ID = 100
    }
}
