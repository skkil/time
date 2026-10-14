package com.skkil.time.features.rituals.domain

data class RitualInput(
    val enabled: Boolean,
    val trigger: String,
    val atMinute: Int,
    val weekdays: Int,
    val steps: List<String>,
)
