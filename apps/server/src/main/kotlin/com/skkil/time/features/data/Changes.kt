package com.skkil.time.features.data

import com.skkil.time.auth.CALLER_ID_ATTRIBUTE
import com.skkil.time.auth.CLIENT_ID_HEADER
import com.skkil.time.common.Caller
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.filter.OncePerRequestFilter

data class Changes(val version: Long, val lastWriter: String?)

/** Counts each user's successful writes, so a client can tell when another device or tab changed the data. */
@Component
class ChangeTracking(private val jdbc: JdbcClient) : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest) =
        !request.requestURI.startsWith("/api/") || request.method !in WRITES

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        chain.doFilter(request, response)
        val user = request.getAttribute(CALLER_ID_ATTRIBUTE) as? Long ?: return
        if (response.status !in 200..299) return
        jdbc
            .sql("UPDATE app_user SET data_version = data_version + 1, last_writer = :writer WHERE id = :id")
            .param("writer", request.getHeader(CLIENT_ID_HEADER)?.take(MAX_CLIENT_ID))
            .param("id", user)
            .update()
    }

    fun read(user: Long): Changes =
        jdbc
            .sql("SELECT data_version, last_writer FROM app_user WHERE id = :id")
            .param("id", user)
            .query { rs, _ -> Changes(rs.getLong("data_version"), rs.getString("last_writer")) }
            .single()

    private companion object {
        val WRITES = setOf("POST", "PUT", "PATCH", "DELETE")
        const val MAX_CLIENT_ID = 100
    }
}

@RestController
class ChangeController(private val changes: ChangeTracking) {
    @GetMapping("/api/v1/changes")
    fun changes(caller: Caller): Changes = changes.read(caller.id)
}
