package com.skkil.time.features.tasks

import com.skkil.time.features.projects.ProjectInput
import com.skkil.time.features.sections.SectionInput
import com.skkil.time.support.ApiTest
import tools.jackson.databind.JsonNode
import java.time.LocalDate
import java.time.ZoneOffset

/** Shared helpers for task-level HTTP tests. */
abstract class TaskApiTest : ApiTest() {
    fun today(): LocalDate = LocalDate.now(ZoneOffset.UTC)

    fun input(title: String, projectId: Long? = null) =
        TaskInput(title, "", projectId, null, null, 4, null, null, null, null, null)

    fun project(name: String) = postJson("/api/v1/projects", ProjectInput(name, null, "teal"))["id"].asLong()

    fun section(projectId: Long?, name: String) =
        postJson("/api/v1/sections", SectionInput(projectId, name, null))["id"].asLong()

    fun create(input: TaskInput): JsonNode = postJson("/api/v1/tasks", input)

    fun task(id: Long): JsonNode = getJson("/api/v1/tasks/$id")

    fun complete(id: Long, completed: Boolean = true): JsonNode =
        putJson("/api/v1/tasks/$id/completed", TaskCompleted(completed))

    fun move(id: Long, placement: TaskPlacement): JsonNode = postJson("/api/v1/tasks/$id/move", placement)

    fun JsonNode.id(): Long = this["id"].asLong()

    fun JsonNode.longOrNull(field: String): Long? = this[field].takeUnless { it.isNull }?.asLong()

    fun JsonNode.textOrNull(field: String): String? = this[field].takeUnless { it.isNull }?.asString()

    fun JsonNode.longs(field: String): List<Long> = this[field].values().map { it.asLong() }
}
