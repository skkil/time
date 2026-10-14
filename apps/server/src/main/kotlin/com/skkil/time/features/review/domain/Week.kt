package com.skkil.time.features.review.domain

import java.time.LocalDate

data class Week(
    val startDate: LocalDate,
    val felt: Int?,
    val step: Int,
    val reviewedAt: Long?,
    val notes: WeekNotes,
    val outcomes: List<Outcome>,
)
