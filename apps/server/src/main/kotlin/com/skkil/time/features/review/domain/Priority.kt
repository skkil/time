package com.skkil.time.features.review.domain

import java.util.UUID

data class Priority(val id: UUID, val title: String, val note: String, val achieved: Int)
