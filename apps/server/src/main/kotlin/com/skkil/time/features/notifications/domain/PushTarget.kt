package com.skkil.time.features.notifications.domain

/** Where a push goes: an Expo push token, or a Web Push endpoint with its subscription keys. */
data class PushTarget(
    val id: Long,
    val kind: String,
    val token: String,
    val p256dh: String?,
    val auth: String?,
    val kinds: Set<String> = ReminderKind.entries.map { it.wire }.toSet(),
)
