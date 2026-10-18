package com.skkil.time.features.notifications.domain

import java.util.UUID

data class Push(val title: String, val body: String, val taskId: UUID)
