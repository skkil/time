package com.skkil.time.features.projects.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.domain.Group
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Named sets of top-level projects. Deleting one only clears it from its projects. */
@Service
@Transactional
class GroupService(private val jdbc: JdbcClient) {
    @Transactional(readOnly = true)
    fun get(user: Long, id: UUID): Group =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Group")

    @Transactional(readOnly = true)
    fun list(user: Long): List<Group> =
        jdbc
            .sql("$SELECT WHERE user_id = :user ORDER BY position, name")
            .param("user", user)
            .query(mapper)
            .list()

    fun create(caller: Caller, name: String, id: UUID? = null): Group {
        val text = requiredText(name, "Name", 80)
        ensure(!taken(caller.id, text, except = null)) { "$text already exists." }
        val id = id ?: caller.nextId()
        jdbc
            .sql(
                """
                INSERT INTO project_group (id, user_id, name, position)
                VALUES (:id, :user, :name,
                        (SELECT COALESCE(MAX(position), 0) + 1 FROM project_group WHERE user_id = :user))
                """,
            ).param("id", id)
            .param("user", caller.id)
            .param("name", text)
            .update()
        return get(caller.id, id)
    }

    fun rename(user: Long, id: UUID, name: String): Group {
        val text = requiredText(name, "Name", 80)
        ensure(!taken(user, text, except = id)) { "$text already exists." }
        val rows =
            jdbc
                .sql("UPDATE project_group SET name = :name WHERE user_id = :user AND id = :id")
                .param("name", text)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Group")
        return get(user, id)
    }

    fun delete(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM project_group WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Group")
    }

    private fun taken(user: Long, name: String, except: UUID?): Boolean =
        jdbc
            .sql(
                """
                SELECT EXISTS(SELECT 1 FROM project_group
                  WHERE user_id = :user AND lower(name) = lower(:name) AND id IS DISTINCT FROM CAST(:except AS UUID))
                """,
            ).param("user", user)
            .param("name", name)
            .param("except", except)
            .query(Boolean::class.java)
            .single()

    private companion object {
        const val SELECT = "SELECT id, name, position FROM project_group"
        val mapper = RowMapper { rs, _ -> Group(rs.uuid("id"), rs.getString("name"), rs.getInt("position")) }
    }
}
