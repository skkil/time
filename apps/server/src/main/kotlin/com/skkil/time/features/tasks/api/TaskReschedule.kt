package com.skkil.time.features.tasks.api

import java.time.LocalDate

data class TaskReschedule(val ids: List<Long>, val dueDate: LocalDate?)
