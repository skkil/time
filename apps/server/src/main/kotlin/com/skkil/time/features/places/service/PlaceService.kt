package com.skkil.time.features.places.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.places.domain.Place
import com.skkil.time.features.tasks.domain.Task
import com.skkil.time.features.tasks.service.TaskService
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Saved places a task can happen at. Deleting one only clears it from its tasks. */
@Service
@Transactional
class PlaceService(private val jdbc: JdbcClient, private val tasks: TaskService) {
    @Transactional(readOnly = true)
    fun get(user: Long, id: UUID): Place =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)
            .orNotFound("Place")

    @Transactional(readOnly = true)
    fun list(user: Long): List<Place> =
        jdbc
            .sql("$SELECT WHERE user_id = :user ORDER BY position, name")
            .param("user", user)
            .query(mapper)
            .list()

    fun create(caller: Caller, name: String, id: UUID? = null): Place {
        val text = requiredText(name, "Name", 80)
        ensure(!taken(caller.id, text, except = null)) { "$text already exists." }
        val id = id ?: caller.nextId()
        jdbc
            .sql(
                """
                INSERT INTO place (id, user_id, name, position)
                VALUES (:id, :user, :name,
                        (SELECT COALESCE(MAX(position), 0) + 1 FROM place WHERE user_id = :user))
                """,
            ).param("id", id)
            .param("user", caller.id)
            .param("name", text)
            .update()
        return get(caller.id, id)
    }

    fun rename(user: Long, id: UUID, name: String): Place {
        val text = requiredText(name, "Name", 80)
        ensure(!taken(user, text, except = id)) { "$text already exists." }
        val rows =
            jdbc
                .sql("UPDATE place SET name = :name WHERE user_id = :user AND id = :id")
                .param("name", text)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Place")
        return get(user, id)
    }

    fun delete(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM place WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Place")
    }

    fun setTaskPlace(user: Long, id: UUID, placeId: UUID?): Task {
        tasks.get(user, id)
        if (placeId != null) get(user, placeId)
        jdbc
            .sql("UPDATE task SET place_id = CAST(:place AS UUID) WHERE user_id = :user AND id = :id")
            .param("place", placeId)
            .param("user", user)
            .param("id", id)
            .update()
        return tasks.get(user, id)
    }

    private fun taken(user: Long, name: String, except: UUID?): Boolean =
        jdbc
            .sql(
                """
                SELECT EXISTS(SELECT 1 FROM place
                  WHERE user_id = :user AND lower(name) = lower(:name) AND id IS DISTINCT FROM CAST(:except AS UUID))
                """,
            ).param("user", user)
            .param("name", name)
            .param("except", except)
            .query(Boolean::class.java)
            .single()

    private companion object {
        const val SELECT = "SELECT id, name, position FROM place"
        val mapper = RowMapper { rs, _ -> Place(rs.uuid("id"), rs.getString("name"), rs.getInt("position")) }
    }
}
