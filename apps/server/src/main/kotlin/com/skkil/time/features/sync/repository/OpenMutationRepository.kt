package com.skkil.time.features.sync.repository

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

/**
 * Reads the mutation store's write path keeps open on the current transaction (`store.scope`, `store.seq`), so a
 * server write can join one that is already open and close without a version when it changed no synced row.
 */
@Repository
class OpenMutationRepository(private val jdbc: JdbcClient) {
    fun isOpen(): Boolean = setting("store.scope").isNotEmpty()

    fun hasChanges(): Boolean = setting("store.seq").let { it.isNotEmpty() && it != "0" }

    /** Closes the open mutation without logging a version; only valid when [hasChanges] is false. */
    fun abandon() {
        jdbc.sql("SELECT set_config('store.scope', '', true)").query().singleRow()
    }

    private fun setting(name: String): String =
        jdbc
            .sql("SELECT coalesce(current_setting(:name, true), '')")
            .param("name", name)
            .query(String::class.java)
            .single()
}
