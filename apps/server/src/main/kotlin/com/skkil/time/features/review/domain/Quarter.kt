package com.skkil.time.features.review.domain

import java.time.LocalDate
import java.util.UUID

data class Quarter(
    val id: UUID,
    val label: String,
    val startDate: LocalDate,
    val weekNo: Int,
    val priorities: List<Priority>,
)
