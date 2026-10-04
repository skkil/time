package com.skkil.time.features.notifications

import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper
import java.net.http.HttpClient
import java.time.Duration

/** Android channel the mobile app creates for reminders. */
const val REMINDER_CHANNEL = "reminders"

/** A reminder is useless once its grace window has passed. */
const val PUSH_TTL_SECONDS = 10 * 60

private val TIMEOUT: Duration = Duration.ofSeconds(10)

fun pushClient(mapper: JsonMapper): RestClient.Builder =
    RestClient
        .builder()
        .requestFactory(
            JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(TIMEOUT).build()).apply {
                setReadTimeout(TIMEOUT)
            },
        ).configureMessageConverters {
            it.registerDefaults().withJsonConverter(JacksonJsonHttpMessageConverter(mapper))
        }
