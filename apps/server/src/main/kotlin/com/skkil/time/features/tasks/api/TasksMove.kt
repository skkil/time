package com.skkil.time.features.tasks.api

import com.skkil.time.features.tasks.domain.MoveTarget
import java.util.UUID

data class TasksMove(val ids: List<UUID>, val target: MoveTarget, val blocks: String? = null)
