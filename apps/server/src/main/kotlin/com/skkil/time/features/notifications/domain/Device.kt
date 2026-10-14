package com.skkil.time.features.notifications.domain

data class Device(val id: Long, val kind: String, val label: String, val createdAt: Long, val lastSeenAt: Long)
