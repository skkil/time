package com.skkil.time.features.tasks.domain

import java.util.UUID

data class TaskPlacement(val projectId: UUID?, val sectionId: UUID?, val parentId: UUID?, val before: UUID?)
