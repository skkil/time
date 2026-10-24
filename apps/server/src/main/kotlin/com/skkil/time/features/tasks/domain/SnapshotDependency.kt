package com.skkil.time.features.tasks.domain

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonPropertyOrder
import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

/** `[taskId, blockedById]`. */
@JsonFormat(shape = JsonFormat.Shape.ARRAY)
@JsonPropertyOrder("taskId", "blockedById")
@Schema(type = "array", description = "[taskId, blockedById]")
data class SnapshotDependency(val taskId: UUID, val blockedById: UUID)
