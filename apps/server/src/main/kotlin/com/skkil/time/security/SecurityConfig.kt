package com.skkil.time.security

import com.skkil.time.common.error.ErrorKind
import com.skkil.time.common.error.ProblemHandler
import com.skkil.time.config.AppProperties
import com.skkil.time.features.calendar.api.CalendarCallbackController
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import tools.jackson.databind.json.JsonMapper

@Configuration
class SecurityConfig(private val properties: AppProperties) {
    @Bean
    fun securityFilterChain(http: HttpSecurity, mapper: JsonMapper): SecurityFilterChain {
        val unauthorized =
            AuthenticationEntryPoint { _, response, _ ->
                response.status = ErrorKind.UNAUTHORIZED.status.value()
                response.contentType = MediaType.APPLICATION_PROBLEM_JSON_VALUE
                mapper.writeValue(
                    response.outputStream,
                    ProblemHandler.problem(ErrorKind.UNAUTHORIZED, "Sign in again"),
                )
            }
        return http
            .csrf { it.disable() }
            .cors { }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .headers { headers ->
                headers.contentSecurityPolicy { it.policyDirectives("default-src 'none'; frame-ancestors 'none'") }
                headers.referrerPolicy { it.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER) }
            }.authorizeHttpRequests {
                it
                    .requestMatchers(HttpMethod.OPTIONS, "/**")
                    .permitAll()
                    .requestMatchers(
                        "/livez",
                        "/readyz",
                        "/actuator/**",
                        "/v3/api-docs/**",
                        "/api/v1/realtime",
                        "/api/v1/sync/jwks.json",
                        CalendarCallbackController.CALLBACK,
                    )
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            }.oauth2ResourceServer { server ->
                server.jwt { }
                server.authenticationEntryPoint(unauthorized)
            }.exceptionHandling { it.authenticationEntryPoint(unauthorized) }
            .build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val config =
            CorsConfiguration().apply {
                allowedOrigins = properties.cors.allowedOrigins
                allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                allowedHeaders = listOf("Authorization", "Content-Type", TIME_ZONE_HEADER, CLIENT_ID_HEADER)
                maxAge = 3600
            }
        val push =
            CorsConfiguration().apply {
                allowedOrigins = properties.cors.allowedOrigins
                allowedMethods = listOf("POST", "OPTIONS")
                allowedHeaders = listOf("Authorization", "Content-Type", "Content-Encoding") + CONNECT_HEADERS
                maxAge = 3600
            }
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/api/**", config)
            registerCorsConfiguration("/skkil.store.v1.PushService/**", push)
        }
    }

    private companion object {
        val CONNECT_HEADERS = listOf("Connect-Protocol-Version", "Connect-Timeout-Ms")
    }
}
