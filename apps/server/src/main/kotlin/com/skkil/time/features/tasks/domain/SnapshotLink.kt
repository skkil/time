package com.skkil.time.features.tasks.domain

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonPropertyOrder
import io.swagger.v3.oas.annotations.media.Schema
import java.util.UUID

/** `[table, id, taskId]`: a time entry or ritual run that pointed at a captured task. */
@JsonFormat(shape = JsonFormat.Shape.ARRAY)
@JsonPropertyOrder("table", "id", "taskId")
@Schema(type = "array", description = "[table, id, taskId]")
data class SnapshotLink(val table: String, val id: UUID, val taskId: UUID)
