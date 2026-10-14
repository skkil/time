package com.skkil.time.features.changes.service

import com.skkil.time.features.changes.domain.Changes
import com.skkil.time.features.realtime.domain.ChangeEvent
import com.skkil.time.features.realtime.service.RealtimeBus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service

@Service
class ChangeService(private val jdbc: JdbcClient, private val bus: RealtimeBus) {
    fun record(user: Long, writer: String?, topic: String) {
        val version =
            jdbc
                .sql(
                    "UPDATE app_user SET data_version = data_version + 1, last_writer = :writer " +
                        "WHERE id = :id RETURNING data_version",
                ).param("writer", writer)
                .param("id", user)
                .query(Long::class.java)
                .optional()
                .orElse(null) ?: return
        bus.publish(user, ChangeEvent("changed", version, writer, topic))
    }

    fun read(user: Long): Changes =
        jdbc
            .sql("SELECT data_version, last_writer FROM app_user WHERE id = :id")
            .param("id", user)
            .query { rs, _ -> Changes(rs.getLong("data_version"), rs.getString("last_writer")) }
            .single()
}
