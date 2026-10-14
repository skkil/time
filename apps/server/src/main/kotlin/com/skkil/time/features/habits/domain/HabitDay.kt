package com.skkil.time.features.habits.domain

import java.time.LocalDate

data class HabitDay(
    val habitId: Long,
    val date: LocalDate,
    val status: DayStatus,
    val value: Double,
    val manual: Boolean,
)
