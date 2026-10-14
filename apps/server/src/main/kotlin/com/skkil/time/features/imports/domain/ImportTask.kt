package com.skkil.time.features.imports.domain

import com.skkil.time.features.tasks.domain.TaskInput

data class ImportTask(val task: TaskInput, val children: List<ImportTask>)
