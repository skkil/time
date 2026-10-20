package com.skkil.time.support

import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.sections.domain.SectionInput
import com.skkil.time.features.tasks.api.TaskCompleted
import com.skkil.time.features.tasks.domain.TaskInput
import com.skkil.time.features.tasks.domain.TaskPlacement
import tools.jackson.databind.JsonNode
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID

/** Shared helpers for task-level HTTP tests. */
abstract class TaskApiTest : ApiTest() {
    fun today(): LocalDate = LocalDate.now(ZoneOffset.UTC)

    fun input(title: String, projectId: UUID? = null) =
        TaskInput(title, "", projectId, null, null, 4, null, null, null, null, null)

    fun project(name: String) = postJson("/api/v1/projects", ProjectInput(name, null, "teal")).id()

    fun section(projectId: UUID?, name: String) = postJson("/api/v1/sections", SectionInput(projectId, name, null)).id()

    fun create(input: TaskInput): JsonNode = postJson("/api/v1/tasks", input)

    fun task(id: UUID): JsonNode = getJson("/api/v1/tasks/$id")

    fun complete(id: UUID, completed: Boolean = true): JsonNode =
        putJson("/api/v1/tasks/$id/completed", TaskCompleted(completed))

    fun move(id: UUID, placement: TaskPlacement): JsonNode = postJson("/api/v1/tasks/$id/move", placement)

    fun JsonNode.textOrNull(field: String): String? = this[field].takeUnless { it.isNull }?.asString()
}
