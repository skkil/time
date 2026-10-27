package com.skkil.time.features.settings.repository

import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.web.Caller
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component

/** Per-user key/value settings, as the desktop `setting` table. */
@Component
class SettingsRepository(private val jdbc: JdbcClient) {
    fun read(user: Long, key: String): String? =
        jdbc
            .sql("SELECT value FROM setting WHERE user_id = :user AND key = :key")
            .param("user", user)
            .param("key", key)
            .query(String::class.java)
            .optional()
            .orElse(null)

    fun write(caller: Caller, key: String, value: String) {
        jdbc
            .sql(
                """
                INSERT INTO setting (id, user_id, key, value) VALUES (:id, :user, :key, :value)
                ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value
                """,
            ).param("id", NaturalIds.setting(caller.scopeId, key))
            .param("user", caller.id)
            .param("key", key)
            .param("value", value)
            .update()
    }
}
