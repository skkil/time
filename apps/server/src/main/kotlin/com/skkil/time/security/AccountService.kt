package com.skkil.time.security

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.persistence.uuid
import com.skkil.time.features.rituals.service.RitualDefaults
import com.skkil.time.features.sync.service.ServerWrites
import org.skkil.store.writepath.StoreWritePath
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.time.ZoneId
import java.util.UUID

/**
 * Accounts and their store scopes. Provisioning seeds the default rows as one server write, and deleting an account
 * logs the deletes and then drops its scope with the log.
 */
@Service
class AccountService(
    private val jdbc: JdbcClient,
    private val rituals: RitualDefaults,
    private val writes: ServerWrites,
    private val writePath: StoreWritePath,
    private val clock: MutationClock,
) {
    fun find(identity: Identity): Account? =
        jdbc
            .sql(
                """
                SELECT u.id, u.scope_id, u.time_zone FROM user_identity i JOIN app_user u ON u.id = i.user_id
                WHERE i.issuer = :issuer AND i.subject = :subject
                """,
            ).param("issuer", identity.issuer)
            .param("subject", identity.subject)
            .query { rs, _ -> account(rs) }
            .optional()
            .orElse(null)

    fun findByScope(scope: UUID): Account? =
        jdbc
            .sql("SELECT id, scope_id, time_zone FROM app_user WHERE scope_id = :scope")
            .param("scope", scope)
            .query { rs, _ -> account(rs) }
            .optional()
            .orElse(null)

    @Transactional
    fun provision(identity: Identity): Account {
        val now = clock.now().epochSecond
        val (id, scope) =
            jdbc
                .sql(
                    "INSERT INTO app_user (email, name, created_at) VALUES (:email, :name, :now) RETURNING id, scope_id",
                ).param("email", identity.email)
                .param("name", identity.name ?: "")
                .param("now", now)
                .query { rs, _ -> rs.getLong("id") to rs.uuid("scope_id") }
                .single()
        val linked =
            jdbc
                .sql(
                    """
                    INSERT INTO user_identity (issuer, subject, user_id, created_at)
                    VALUES (:issuer, :subject, :user, :now) ON CONFLICT DO NOTHING
                    """,
                ).param("issuer", identity.issuer)
                .param("subject", identity.subject)
                .param("user", id)
                .param("now", now)
                .update()
        if (linked == 0) {
            jdbc.sql("DELETE FROM app_user WHERE id = :id").param("id", id).update()
            return find(identity) ?: error("Identity vanished during provisioning")
        }
        writes.run(scope) { rituals.seed(id, scope) }
        return Account(id, scope, ZoneId.of("UTC"))
    }

    fun saveZone(user: Long, zone: ZoneId) {
        jdbc
            .sql("UPDATE app_user SET time_zone = :zone WHERE id = :id")
            .param("zone", zone.id)
            .param("id", user)
            .update()
    }

    @Transactional
    fun delete(user: Long, scope: UUID) {
        writes.run(scope) { jdbc.sql("DELETE FROM app_user WHERE id = :id").param("id", user).update() }
        writePath.dropScope(scope)
    }

    private fun account(rs: ResultSet) =
        Account(rs.getLong("id"), rs.uuid("scope_id"), zoneOrUtc(rs.getString("time_zone")))

    private fun zoneOrUtc(id: String): ZoneId = runCatching { ZoneId.of(id) }.getOrDefault(ZoneId.of("UTC"))
}
