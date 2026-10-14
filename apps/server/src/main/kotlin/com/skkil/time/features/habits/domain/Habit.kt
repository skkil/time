package com.skkil.time.features.habits.domain

import java.time.LocalDate

data class Habit(
    val id: Long,
    val name: String,
    val kind: String,
    val goal: Double,
    val unit: String,
    val days: Int,
    val timeOfDay: String,
    val area: String,
    val startDate: LocalDate,
    val tracking: Tracking?,
    val skipDays: Int,
    val anchor: String,
    val doneDays: Int,
    val dueDays: Int,
    val cleanSince: LocalDate?,
)
