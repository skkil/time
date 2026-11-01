package com.skkil.time.features.sync.service

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.persistence.uuid
import com.skkil.time.features.sync.domain.BASELINE_TABLES
import com.skkil.time.features.sync.domain.BaselineTable
import org.skkil.store.writepath.StoreWritePath
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/** Advisory lock namespace for baselining one account; the second key is a hash of its user id. */
internal const val BASELINE_LOCK_KEY = 0x736B6B69

/**
 * Baselines: one server write that logs every synced row an account owns with `store_capture_existing`, parents
 * first, so a device pulling the scope from version 0 also receives the rows the log never captured (written before
 * `V13` or rewritten under `store.bypass`). `sync_baseline` lists the accounts whose log holds all their rows.
 */
@Service
class BaselineService(
    private val jdbc: JdbcClient,
    private val writePath: StoreWritePath,
    private val clock: MutationClock,
    transactions: PlatformTransactionManager,
) {
    private val transaction = TransactionTemplate(transactions)

    /** Accounts whose log may miss rows, as user id and scope, oldest first. */
    fun pending(): List<Pair<Long, UUID>> =
        jdbc
            .sql(
                """
                SELECT u.id, u.scope_id FROM app_user u
                WHERE NOT EXISTS (SELECT 1 FROM sync_baseline b WHERE b.user_id = u.id)
                ORDER BY u.id
                """,
            ).query { rs, _ -> rs.getLong("id") to rs.uuid("scope_id") }
            .list()

    /**
     * Baselines [user] in a transaction of its own, unless another instance is baselining it or it already is;
     * returns whether this call did it.
     */
    fun baseline(user: Long, scope: UUID): Boolean =
        transaction.execute {
            val locked =
                jdbc
                    .sql("SELECT pg_try_advisory_xact_lock(:key, hashint8(:user))")
                    .param("key", BASELINE_LOCK_KEY)
                    .param("user", user)
                    .query(Boolean::class.java)
                    .single()
            if (!locked || isBaselined(user)) return@execute false
            record(user, capture(user, scope))
            true
        } ?: false

    /** Records a new account as baselined in the caller's transaction: the log holds its rows from the first one. */
    fun markNew(user: Long) = record(user, null)

    /**
     * Starts the scope over after its rows were replaced (a restore), in the caller's transaction and outside any
     * open write: bumps its epoch, so every device resets and pulls again from version 0, and baselines it.
     */
    fun restart(user: Long, scope: UUID) {
        check(!writePath.isOpen()) { "Restart a scope after closing the write that replaced its rows" }
        jdbc
            .sql("SELECT pg_advisory_xact_lock(:key, hashint8(:user))")
            .param("key", BASELINE_LOCK_KEY)
            .param("user", user)
            .query()
            .singleRow()
        writePath.bumpEpoch(scope)
        record(user, capture(user, scope))
    }

    private fun isBaselined(user: Long): Boolean =
        jdbc
            .sql("SELECT EXISTS (SELECT 1 FROM sync_baseline WHERE user_id = :user)")
            .param("user", user)
            .query(Boolean::class.java)
            .single()

    private fun capture(user: Long, scope: UUID): Long? {
        writePath.beginServer(scope)
        for (table in BASELINE_TABLES) writePath.captureExisting(table.name, table.column, owned(user, table))
        return writePath.endIfChanged()
    }

    private fun owned(user: Long, table: BaselineTable): List<Any> {
        val parent = table.parent ?: return listOf(user)
        return jdbc
            .sql("SELECT id FROM $parent WHERE user_id = :user")
            .param("user", user)
            .query(UUID::class.java)
            .list()
            .filterNotNull()
    }

    private fun record(user: Long, version: Long?) {
        jdbc
            .sql(
                """
                INSERT INTO sync_baseline (user_id, version, done_at) VALUES (:user, :version, :now)
                ON CONFLICT (user_id) DO UPDATE SET version = excluded.version, done_at = excluded.done_at
                """,
            ).param("user", user)
            .param("version", version)
            .param("now", clock.now().epochSecond)
            .update()
    }
}
