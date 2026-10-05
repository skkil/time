package com.skkil.time.common

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("time")
data class AppProperties(
    val cors: Cors = Cors(),
    val rateLimit: RateLimit = RateLimit(),
    val push: Push = Push(),
) {
    data class Cors(val allowedOrigins: List<String> = emptyList())

    data class RateLimit(val requestsPerMinute: Int = 600)

    /** Push delivery. Blank values count as unset; web push needs all three VAPID values. */
    data class Push(
        val reminders: Boolean = true,
        val expoAccessToken: String = "",
        val webPushPublicKey: String = "",
        val webPushPrivateKey: String = "",
        val webPushSubject: String = "",
    )
}
