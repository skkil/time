package com.skkil.time.features.review.domain

import java.time.LocalDate

data class Day(val date: LocalDate, val felt: Int?, val note: String, val skipped: Boolean)
