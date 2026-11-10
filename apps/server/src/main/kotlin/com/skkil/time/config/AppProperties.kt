package com.skkil.time.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties("time")
data class AppProperties(
    val cors: Cors = Cors(),
    val rateLimit: RateLimit = RateLimit(),
    val push: Push = Push(),
    val sync: Sync = Sync(),
    val calendar: Calendar = Calendar(),
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

    /**
     * Sync through store: the store service's base URL handed to devices, and the ES256 key pair (PKCS#8 and SPKI
     * PEM) that signs sync tokens. Without keys, only the `dev` profile starts, with a key made at startup.
     * [baselineOnStart] runs the baseline job when the server is ready.
     */
    data class Sync(
        val storeUrl: String = "http://localhost:8091",
        val tokenPrivateKeyPem: String = "",
        val tokenPublicKeyPem: String = "",
        val baselineOnStart: Boolean = true,
    )

    /**
     * Connected calendars. [provider] `google` connects through Google's OAuth and stays off until [googleClientId],
     * [googleClientSecret] and [tokenKey] (base64 of 32 bytes that encrypt stored tokens) are all set; `fake` serves
     * fixtures without a network, for `skkil dev` and tests. [redirectUri] is this server's public callback URL, and
     * [sync] runs the background sync.
     */
    data class Calendar(
        val provider: String = "google",
        val googleClientId: String = "",
        val googleClientSecret: String = "",
        val tokenKey: String = "",
        val redirectUri: String = "http://localhost:8080/api/v1/calendar/google/callback",
        val sync: Boolean = true,
    )
}
