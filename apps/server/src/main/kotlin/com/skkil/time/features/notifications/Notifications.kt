package com.skkil.time.features.notifications

data class PushConfig(val webPushPublicKey: String?)

data class DeviceInput(
    val kind: String,
    val token: String,
    val p256dh: String? = null,
    val auth: String? = null,
    val label: String? = null,
)

data class DeviceId(val id: Long)

data class Device(val id: Long, val kind: String, val label: String, val createdAt: Long, val lastSeenAt: Long)

/** Where a push goes: an Expo push token, or a Web Push endpoint with its subscription keys. */
data class PushTarget(val id: Long, val kind: String, val token: String, val p256dh: String?, val auth: String?)

data class Push(val title: String, val body: String, val taskId: Long)

data class PushMessage(val target: PushTarget, val push: Push)

/** Delivers pushes for one device [kind]; returns the ids of devices the push service says are gone. */
interface PushSender {
    val kind: String

    fun send(messages: List<PushMessage>): Set<Long>
}

const val EXPO = "expo"
const val WEB = "web"
