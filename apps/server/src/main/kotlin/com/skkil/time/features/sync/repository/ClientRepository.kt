package com.skkil.time.features.sync.repository

import com.skkil.time.common.persistence.uuid
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

/** store's `store_client` rows: each client id belongs to one scope for life. */
@Repository
class ClientRepository(private val jdbc: JdbcClient) {
    /** Records that [client] belongs to [scope] unless it is already known, and returns the scope that owns it. */
    fun claim(client: UUID, scope: UUID): UUID {
        jdbc.sql("SELECT store_ensure_scope(:scope)").param("scope", scope).query().singleRow()
        jdbc
            .sql("INSERT INTO store_client (client_id, scope_id) VALUES (:client, :scope) ON CONFLICT DO NOTHING")
            .param("client", client)
            .param("scope", scope)
            .update()
        return jdbc
            .sql("SELECT scope_id FROM store_client WHERE client_id = :client")
            .param("client", client)
            .query { rs, _ -> rs.uuid("scope_id") }
            .single()
    }
}
