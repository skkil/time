package com.skkil.time.features.workflow.domain

import java.util.UUID

data class ItemStatus(val id: UUID, val projectId: UUID, val name: String, val category: String, val position: Int)
