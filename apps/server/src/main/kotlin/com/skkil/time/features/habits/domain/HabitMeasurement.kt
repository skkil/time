package com.skkil.time.features.habits.domain

import java.time.LocalDate
import java.util.UUID

/** A website or app habit's measured [value] on [date] (times or minutes), as the device read it. */
data class HabitMeasurement(val habitId: UUID, val date: LocalDate, val value: Double)
