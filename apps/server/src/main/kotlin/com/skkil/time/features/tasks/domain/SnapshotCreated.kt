package com.skkil.time.features.tasks.domain

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonPropertyOrder
import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

/** `[id, createdAt]`: a captured task and when it was made, so a task that reused the id is never overwritten. */
@JsonFormat(shape = JsonFormat.Shape.ARRAY)
@JsonPropertyOrder("id", "createdAt")
@Schema(type = "array", description = "[id, createdAt]")
data class SnapshotCreated(val id: UUID, val createdAt: Long)
