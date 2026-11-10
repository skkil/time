package com.skkil.time.features.glance.domain

import com.skkil.time.features.time.domain.RunningTimer

data class Glance(
    val timer: RunningTimer?,
    val now: GlanceItem?,
    val next: GlanceItem?,
    val musts: List<GlanceTask>,
    val earlierCount: Int,
)
