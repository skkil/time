package com.skkil.time.features.glance.domain

import java.util.UUID

data class GlanceItem(val kind: GlanceKind, val title: String, val taskId: UUID, val startsAt: Long, val endsAt: Long?)
