package com.skkil.time.features.notifications.push

import com.interaso.webpush.VapidKeys
import com.interaso.webpush.WebPush
import com.skkil.time.config.AppProperties
import com.skkil.time.features.notifications.domain.Push
import com.skkil.time.features.notifications.domain.PushMessage
import com.skkil.time.features.notifications.domain.WEB
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import java.net.URI
import java.util.Base64

/** Sends Web Push (VAPID, aes128gcm). Off unless the VAPID keys and subject are configured. */
@Component
class WebPushSender(private val mapper: JsonMapper, properties: AppProperties) : PushSender {
    override val kind = WEB

    private val webPush: WebPush? =
        with(properties.push) {
            if (listOf(webPushPublicKey, webPushPrivateKey, webPushSubject).any { it.isBlank() }) {
                null
            } else {
                WebPush(webPushSubject, VapidKeys.fromUncompressedBytes(webPushPublicKey, webPushPrivateKey))
            }
        }

    /** The VAPID key browsers subscribe with, or null while web push is off. */
    val publicKey: String? = properties.push.webPushPublicKey.takeIf { webPush != null }

    private val client = pushClient(mapper).build()

    override fun send(messages: List<PushMessage>): Set<Long> {
        val webPush = webPush ?: return emptySet()
        return messages
            .filter { message ->
                runCatching { gone(webPush, message) }
                    .onFailure { log.warn("Web push failed for device {}: {}", message.target.id, it.message) }
                    .getOrDefault(false)
            }.map { it.target.id }
            .toSet()
    }

    private fun gone(webPush: WebPush, message: PushMessage): Boolean {
        val target = message.target
        val body =
            webPush.getBody(
                mapper.writeValueAsBytes(message.push),
                decode(target.p256dh.orEmpty()),
                decode(target.auth.orEmpty()),
            )
        val headers = webPush.getHeaders(target.token, PUSH_TTL_SECONDS, null, WebPush.Urgency.High)
        val status =
            client
                .post()
                .uri(URI.create(target.token))
                .headers { http -> headers.forEach(http::set) }
                .body(body)
                .exchange { _, response -> response.statusCode.value() }
        if (status == NOT_FOUND || status == GONE) return true
        if (status !in 200..299) log.warn("Web push to device {} returned {}", target.id, status)
        return false
    }

    private fun decode(value: String) = Base64.getUrlDecoder().decode(value.trimEnd('='))

    private companion object {
        const val NOT_FOUND = 404
        const val GONE = 410
        val log = LoggerFactory.getLogger(WebPushSender::class.java)
    }
}
