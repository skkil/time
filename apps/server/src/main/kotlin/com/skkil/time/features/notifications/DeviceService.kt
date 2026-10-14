package com.skkil.time.features.notifications

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class DeviceService(private val jdbc: JdbcClient) {
    fun list(user: Long): List<Device> =
        jdbc
            .sql(
                """
                SELECT id, kind, label, created_at, last_seen_at FROM push_device
                WHERE user_id = :user ORDER BY id
                """,
            ).param("user", user)
            .query { rs, _ ->
                Device(
                    rs.getLong("id"),
                    rs.getString("kind"),
                    rs.getString("label"),
                    rs.getLong("created_at"),
                    rs.getLong("last_seen_at"),
                )
            }.list()

    /** Registers a device, or refreshes it; a token registered before moves to [user]. */
    fun register(user: Long, input: DeviceInput): DeviceId {
        ensure(input.kind == EXPO || input.kind == WEB) { "Device kind must be expo or web." }
        val token = requiredText(input.token, "Device token", MAX_TOKEN)
        val keys =
            if (input.kind == WEB) {
                requiredText(input.p256dh ?: "", "Subscription key", MAX_KEY) to
                    requiredText(input.auth ?: "", "Subscription secret", MAX_KEY)
            } else {
                null to null
            }
        val now = Instant.now().epochSecond
        val id =
            jdbc
                .sql(
                    """
                    INSERT INTO push_device (user_id, kind, token, p256dh, auth, label, created_at, last_seen_at)
                    VALUES (:user, :kind, :token, :p256dh, :auth, :label, :now, :now)
                    ON CONFLICT (kind, token) DO UPDATE SET
                      user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
                      label = excluded.label, last_seen_at = excluded.last_seen_at
                    RETURNING id
                    """,
                ).param("user", user)
                .param("kind", input.kind)
                .param("token", token)
                .param("p256dh", keys.first)
                .param("auth", keys.second)
                .param("label", optionalText(input.label ?: "", "Device label", MAX_LABEL))
                .param("now", now)
                .query(Long::class.java)
                .single()
        return DeviceId(id)
    }

    fun delete(user: Long, id: Long) {
        val rows =
            jdbc
                .sql("DELETE FROM push_device WHERE id = :id AND user_id = :user")
                .param("id", id)
                .param("user", user)
                .update()
        ensureChanged(rows, "Device")
    }

    fun targets(users: Collection<Long>): Map<Long, List<PushTarget>> =
        jdbc
            .sql("SELECT id, user_id, kind, token, p256dh, auth FROM push_device WHERE user_id IN (:users)")
            .param("users", users)
            .query { rs, _ ->
                rs.getLong("user_id") to
                    PushTarget(
                        rs.getLong("id"),
                        rs.getString("kind"),
                        rs.getString("token"),
                        rs.getString("p256dh"),
                        rs.getString("auth"),
                    )
            }.list()
            .groupBy({ it.first }, { it.second })

    fun forget(ids: Collection<Long>) {
        if (ids.isEmpty()) return
        jdbc.sql("DELETE FROM push_device WHERE id IN (:ids)").param("ids", ids).update()
    }

    private companion object {
        const val MAX_TOKEN = 2048
        const val MAX_KEY = 256
        const val MAX_LABEL = 200
    }
}
