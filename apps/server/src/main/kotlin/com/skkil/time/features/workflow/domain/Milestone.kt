package com.skkil.time.features.workflow.domain

import java.time.LocalDate
import java.util.UUID

data class Milestone(val id: UUID, val projectId: UUID, val name: String, val date: LocalDate?, val position: Int)
