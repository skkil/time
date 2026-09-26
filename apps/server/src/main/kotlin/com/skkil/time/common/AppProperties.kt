package com.skkil.time.common

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("time")
data class AppProperties(
    val cors: Cors = Cors(),
    val rateLimit: RateLimit = RateLimit(),
) {
    data class Cors(val allowedOrigins: List<String> = emptyList())

    data class RateLimit(val requestsPerMinute: Int = 600)
}
