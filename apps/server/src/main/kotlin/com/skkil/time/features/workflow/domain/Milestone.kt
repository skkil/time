package com.skkil.time.features.workflow.domain

import java.time.LocalDate

data class Milestone(val id: Long, val projectId: Long, val name: String, val date: LocalDate?, val position: Int)
