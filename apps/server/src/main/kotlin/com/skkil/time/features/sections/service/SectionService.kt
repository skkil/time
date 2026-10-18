package com.skkil.time.features.sections.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.persistence.uuidOrNull
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.sections.domain.Section
import com.skkil.time.features.sections.domain.SectionInput
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Ordered groups inside a project or the Inbox (`projectId = null`). Deleting one deletes its tasks. */
@Service
@Transactional
class SectionService(private val jdbc: JdbcClient, private val projects: ProjectService) {
    @Transactional(readOnly = true)
    fun get(user: Long, id: UUID): Section =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Section")

    @Transactional(readOnly = true)
    fun list(user: Long): List<Section> =
        jdbc
            .sql("$SELECT WHERE user_id = :user ORDER BY position, id")
            .param("user", user)
            .query(mapper)
            .list()

    fun create(caller: Caller, input: SectionInput, id: UUID? = null): Section {
        val user = caller.id
        val name = requiredText(input.name, "Section name", 120)
        input.projectId?.let {
            ensure(!projects.get(user, it).archived) { "Can't add sections to an archived project." }
        }
        val id = id ?: caller.nextId()
        jdbc
            .sql("INSERT INTO section (id, user_id, project_id, name) VALUES (:id, :user, :project, :name)")
            .param("id", id)
            .param("user", user)
            .param("project", input.projectId)
            .param("name", name)
            .update()
        place(user, id, input.projectId, input.before)
        return get(user, id)
    }

    fun rename(user: Long, id: UUID, name: String): Section {
        val text = requiredText(name, "Section name", 120)
        ensureChanged(updateColumn(user, id, "name", text), "Section")
        return get(user, id)
    }

    fun setCollapsed(user: Long, id: UUID, collapsed: Boolean): Section {
        ensureChanged(updateColumn(user, id, "collapsed", collapsed), "Section")
        return get(user, id)
    }

    fun reorder(user: Long, id: UUID, before: UUID?): Section {
        val section = get(user, id)
        place(user, id, section.projectId, before)
        return get(user, id)
    }

    fun delete(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM section WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Section")
    }

    private fun place(user: Long, id: UUID, projectId: UUID?, before: UUID?) {
        val ids =
            jdbc
                .sql(
                    """
                    SELECT id FROM section
                    WHERE user_id = :user AND project_id IS NOT DISTINCT FROM :project AND id <> :id
                    ORDER BY position, id
                    """,
                ).param("user", user)
                .param("project", projectId)
                .param("id", id)
                .query(UUID::class.java)
                .list()
                .toMutableList()
        val index = ids.indexOf(before).takeIf { it >= 0 } ?: ids.size
        ids.add(index, id)
        ids.forEachIndexed { position, section ->
            jdbc
                .sql("UPDATE section SET position = :position WHERE id = :id")
                .param("position", position + 1)
                .param("id", section)
                .update()
        }
    }

    private fun updateColumn(user: Long, id: UUID, column: String, value: Any): Int =
        jdbc
            .sql("UPDATE section SET $column = :value WHERE user_id = :user AND id = :id")
            .param("value", value)
            .param("user", user)
            .param("id", id)
            .update()

    private companion object {
        const val SELECT = "SELECT id, project_id, name, position, collapsed FROM section"
        val mapper =
            RowMapper { rs, _ ->
                Section(
                    rs.uuid("id"),
                    rs.uuidOrNull("project_id"),
                    rs.getString("name"),
                    rs.getInt("position"),
                    rs.getBoolean("collapsed"),
                )
            }
    }
}
