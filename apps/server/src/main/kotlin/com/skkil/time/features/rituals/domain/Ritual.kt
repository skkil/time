package com.skkil.time.features.rituals.domain

data class Ritual(
    val kind: String,
    val enabled: Boolean,
    val trigger: String,
    val atMinute: Int,
    val weekdays: Int,
    val minMinutes: Int,
    val steps: List<String>,
)
