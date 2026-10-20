package com.skkil.time.features.habits.domain

import java.time.LocalDate
import java.util.UUID

data class HabitDay(
    val habitId: UUID,
    val date: LocalDate,
    val status: DayStatus,
    val value: Double,
    val manual: Boolean,
)
