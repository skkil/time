package com.skkil.time.features.review.domain

import java.time.LocalDate

data class Quarter(
    val id: Long,
    val label: String,
    val startDate: LocalDate,
    val weekNo: Int,
    val priorities: List<Priority>,
)
