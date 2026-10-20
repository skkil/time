package com.skkil.time.features.preferences.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.web.Caller
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper

/**
 * Account-wide UI preferences (name, week start, sleep hours, priority colours, ...) as one JSON object, so
 * every signed-in device shows the same. Per-device preferences never reach the server.
 */
@Service
@Transactional
class PreferenceService(private val jdbc: JdbcClient, private val mapper: JsonMapper) {
    @Transactional(readOnly = true)
    fun read(user: Long): Map<String, Any?> =
        jdbc
            .sql("SELECT \"values\"::text FROM user_preference WHERE user_id = :user")
            .param("user", user)
            .query(String::class.java)
            .optional()
            .map { mapper.readValue(it, MAP) }
            .orElse(emptyMap())

    /** Merges [changes] into the stored object; a `null` value removes the key. */
    fun merge(caller: Caller, changes: Map<String, Any?>): Map<String, Any?> {
        ensure(changes.keys.all { it.length in 1..MAX_KEY }) { "Preference names are 1 to $MAX_KEY characters." }
        val next = (read(caller.id) + changes).filterValues { it != null }
        ensure(next.size <= MAX_KEYS) { "Too many preferences." }
        val json = mapper.writeValueAsString(next)
        ensure(json.length <= MAX_BYTES) { "Preferences are too large." }
        jdbc
            .sql(
                """
                INSERT INTO user_preference (id, user_id, "values", updated_at)
                VALUES (:id, :user, CAST(:json AS JSONB), :now)
                ON CONFLICT (user_id) DO UPDATE SET "values" = excluded."values", updated_at = excluded.updated_at
                """,
            ).param("id", caller.nextId())
            .param("user", caller.id)
            .param("json", json)
            .param("now", caller.now())
            .update()
        return next
    }

    private companion object {
        val MAP = object : TypeReference<Map<String, Any?>>() {}
        const val MAX_KEY = 64
        const val MAX_KEYS = 100
        const val MAX_BYTES = 32 * 1024
    }
}
