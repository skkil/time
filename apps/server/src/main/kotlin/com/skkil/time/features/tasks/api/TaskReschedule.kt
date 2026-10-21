package com.skkil.time.features.tasks.api

import java.time.LocalDate
import java.util.UUID

data class TaskReschedule(val ids: List<UUID>, val dueDate: LocalDate?)
