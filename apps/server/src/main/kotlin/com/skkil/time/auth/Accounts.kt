package com.skkil.time.auth

import com.skkil.time.features.rituals.RitualDefaults
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.ZoneId

data class Identity(val issuer: String, val subject: String, val email: String?, val name: String?)

data class Account(val id: Long, val zone: ZoneId)

@Service
class Accounts(private val jdbc: JdbcClient, private val rituals: RitualDefaults) {
    fun find(identity: Identity): Account? =
        jdbc
            .sql(
                """
                SELECT u.id, u.time_zone FROM user_identity i JOIN app_user u ON u.id = i.user_id
                WHERE i.issuer = :issuer AND i.subject = :subject
                """,
            ).param("issuer", identity.issuer)
            .param("subject", identity.subject)
            .query { rs, _ -> Account(rs.getLong("id"), zoneOrUtc(rs.getString("time_zone"))) }
            .optional()
            .orElse(null)

    @Transactional
    fun provision(identity: Identity): Account {
        val now = Instant.now().epochSecond
        val id =
            jdbc
                .sql("INSERT INTO app_user (email, name, created_at) VALUES (:email, :name, :now) RETURNING id")
                .param("email", identity.email)
                .param("name", identity.name ?: "")
                .param("now", now)
                .query(Long::class.java)
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
        rituals.seed(id)
        return Account(id, ZoneId.of("UTC"))
    }

    fun saveZone(user: Long, zone: ZoneId) {
        jdbc
            .sql("UPDATE app_user SET time_zone = :zone WHERE id = :id")
            .param("zone", zone.id)
            .param("id", user)
            .update()
    }

    @Transactional
    fun delete(user: Long) {
        jdbc.sql("DELETE FROM app_user WHERE id = :id").param("id", user).update()
    }

    private fun zoneOrUtc(id: String): ZoneId = runCatching { ZoneId.of(id) }.getOrDefault(ZoneId.of("UTC"))
}
