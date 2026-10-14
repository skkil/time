package com.skkil.time.features.sections.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.text.requiredText
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.sections.domain.Section
import com.skkil.time.features.sections.domain.SectionInput
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** Ordered groups inside a project or the Inbox (`projectId = null`). Deleting one deletes its tasks. */
@Service
@Transactional
class SectionService(private val jdbc: JdbcClient, private val projects: ProjectService) {
    @Transactional(readOnly = true)
    fun get(user: Long, id: Long): Section =
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

    fun create(user: Long, input: SectionInput): Section {
        val name = requiredText(input.name, "Section name", 120)
        input.projectId?.let {
            ensure(!projects.get(user, it).archived) { "Can't add sections to an archived project." }
        }
        val id =
            jdbc
                .sql("INSERT INTO section (user_id, project_id, name) VALUES (:user, :project, :name) RETURNING id")
                .param("user", user)
                .param("project", input.projectId)
                .param("name", name)
                .query(Long::class.java)
                .single()
        place(user, id, input.projectId, input.before)
        return get(user, id)
    }

    fun rename(user: Long, id: Long, name: String): Section {
        val text = requiredText(name, "Section name", 120)
        ensureChanged(updateColumn(user, id, "name", text), "Section")
        return get(user, id)
    }

    fun setCollapsed(user: Long, id: Long, collapsed: Boolean): Section {
        ensureChanged(updateColumn(user, id, "collapsed", collapsed), "Section")
        return get(user, id)
    }

    fun reorder(user: Long, id: Long, before: Long?): Section {
        val section = get(user, id)
        place(user, id, section.projectId, before)
        return get(user, id)
    }

    fun delete(user: Long, id: Long) {
        val rows =
            jdbc
                .sql("DELETE FROM section WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Section")
    }

    private fun place(user: Long, id: Long, projectId: Long?, before: Long?) {
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
                .query(Long::class.java)
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

    private fun updateColumn(user: Long, id: Long, column: String, value: Any): Int =
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
                    rs.getLong("id"),
                    rs.longOrNull("project_id"),
                    rs.getString("name"),
                    rs.getInt("position"),
                    rs.getBoolean("collapsed"),
                )
            }
    }
}
