package com.skkil.time.common.web

import com.skkil.time.common.error.ErrorKind
import com.skkil.time.common.error.ProblemHandler
import com.skkil.time.config.AppProperties
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/** A per-client fixed-window limit. The edge (load balancer, WAF) is the main defence; this caps runaway clients. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class RateLimitFilter(private val properties: AppProperties, private val mapper: JsonMapper) : OncePerRequestFilter() {
    private data class Window(val minute: Long, val count: AtomicInteger)

    private val windows = ConcurrentHashMap<String, Window>()

    override fun shouldNotFilter(request: HttpServletRequest) = !request.requestURI.startsWith("/api/")

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val minute = Instant.now().epochSecond / 60
        if (windows.size > MAX_CLIENTS) windows.entries.removeIf { it.value.minute < minute }
        val window =
            windows.compute(request.remoteAddr) { _, current ->
                if (current == null || current.minute != minute) Window(minute, AtomicInteger()) else current
            }!!
        if (window.count.incrementAndGet() > properties.rateLimit.requestsPerMinute) {
            response.status = ErrorKind.RATE_LIMITED.status.value()
            response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
            response.setHeader("Retry-After", "60")
            mapper.writeValue(
                response.outputStream,
                ProblemHandler.problem(ErrorKind.RATE_LIMITED, "Too many requests"),
            )
            return
        }
        chain.doFilter(request, response)
    }

    private companion object {
        const val MAX_CLIENTS = 10_000
    }
}
