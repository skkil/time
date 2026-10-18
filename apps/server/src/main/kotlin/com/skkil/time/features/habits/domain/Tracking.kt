package com.skkil.time.features.habits.domain

import java.util.UUID

data class Tracking(val source: String, val patterns: List<String>, val projectId: UUID?)
