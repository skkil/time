package com.skkil.time.features.notifications.domain

data class DeviceInput(
    val kind: String,
    val token: String,
    val p256dh: String? = null,
    val auth: String? = null,
    val label: String? = null,
    val scheduling: String? = null,
    val kinds: List<String>? = null,
)
