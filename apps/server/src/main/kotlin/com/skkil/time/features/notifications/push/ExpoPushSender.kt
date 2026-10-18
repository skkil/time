package com.skkil.time.features.notifications.push

import com.skkil.time.config.AppProperties
import com.skkil.time.features.notifications.domain.EXPO
import com.skkil.time.features.notifications.domain.PushMessage
import org.slf4j.LoggerFactory
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.body
import tools.jackson.databind.json.JsonMapper

/** Sends through Expo's push service, which hands the push on to FCM or APNs. */
@Component
class ExpoPushSender(mapper: JsonMapper, properties: AppProperties) : PushSender {
    override val kind = EXPO

    private val client =
        pushClient(mapper)
            .baseUrl(SEND_URL)
            .defaultHeaders { headers ->
                properties.push.expoAccessToken
                    .takeIf { it.isNotBlank() }
                    ?.let { headers.setBearerAuth(it) }
            }.build()

    override fun send(messages: List<PushMessage>): Set<Long> =
        messages
            .chunked(BATCH)
            .flatMap { batch ->
                runCatching { sendBatch(batch) }
                    .onFailure { log.warn("Expo push failed for {} messages: {}", batch.size, it.message) }
                    .getOrDefault(emptyList())
            }.toSet()

    private fun sendBatch(batch: List<PushMessage>): List<Long> {
        val tickets =
            client
                .post()
                .contentType(MediaType.APPLICATION_JSON)
                .body(batch.map(::expoMessage))
                .retrieve()
                .body<ExpoResponse>()
                ?.data
                .orEmpty()
        tickets
            .filter { it.status == "error" }
            .forEach { log.warn("Expo push rejected: {} {}", it.details?.error, it.message) }
        return batch
            .zip(tickets)
            .filter { (_, ticket) -> ticket.details?.error == DEVICE_NOT_REGISTERED }
            .map { (message, _) -> message.target.id }
    }

    private fun expoMessage(message: PushMessage) =
        ExpoMessage(
            to = message.target.token,
            title = message.push.title,
            body = message.push.body,
            data = mapOf("taskId" to message.push.taskId.toString()),
        )

    data class ExpoMessage(
        val to: String,
        val title: String,
        val body: String,
        val data: Map<String, String>,
        val sound: String = "default",
        val channelId: String = REMINDER_CHANNEL,
        val priority: String = "high",
        val ttl: Int = PUSH_TTL_SECONDS,
    )

    data class ExpoResponse(val data: List<ExpoTicket> = emptyList())

    data class ExpoTicket(val status: String = "", val message: String? = null, val details: ExpoDetails? = null)

    data class ExpoDetails(val error: String? = null)

    private companion object {
        const val SEND_URL = "https://exp.host/--/api/v2/push/send"
        const val BATCH = 100
        const val DEVICE_NOT_REGISTERED = "DeviceNotRegistered"
        val log = LoggerFactory.getLogger(ExpoPushSender::class.java)
    }
}
