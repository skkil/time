package com.skkil.time.features.calendar.repository

import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.persistence.uuid
import com.skkil.time.features.calendar.domain.CalendarAccount
import com.skkil.time.features.calendar.domain.CalendarEvent
import com.skkil.time.features.calendar.domain.CalendarSource
import com.skkil.time.features.calendar.domain.ConnectedAccount
import com.skkil.time.features.calendar.domain.PendingConnect
import com.skkil.time.features.calendar.domain.SyncedSource
import com.skkil.time.features.calendar.provider.ProviderEvent
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID

/** Calendar accounts, consents in progress, calendars and events, always filtered by their owner. */
@Repository
class CalendarRepository(private val jdbc: JdbcClient) {
    fun scopeOf(user: Long): UUID =
        jdbc.sql("SELECT scope_id FROM app_user WHERE id = :user").param("user", user).query(UUID::class.java).single()

    fun savePending(state: String, user: Long, verifier: String, expiresAt: Long, now: Long) {
        jdbc.sql("DELETE FROM calendar_connect WHERE expires_at <= :now").param("now", now).update()
        jdbc
            .sql(
                "INSERT INTO calendar_connect (state, user_id, verifier, expires_at) VALUES (:state, :user, :verifier, :expires)",
            )
            .param("state", state)
            .param("user", user)
            .param("verifier", verifier)
            .param("expires", expiresAt)
            .update()
    }

    fun takePending(state: String, now: Long): PendingConnect? =
        jdbc
            .sql("DELETE FROM calendar_connect WHERE state = :state RETURNING user_id, verifier, expires_at")
            .param("state", state)
            .query { rs, _ -> Triple(rs.getLong("user_id"), rs.getString("verifier"), rs.getLong("expires_at")) }
            .optional()
            .orElse(null)
            ?.takeIf { (_, _, expires) -> expires > now }
            ?.let { (user, verifier, _) -> PendingConnect(user, verifier) }

    fun accounts(user: Long): List<CalendarAccount> =
        jdbc
            .sql(
                """
                SELECT id, provider, email, status, synced_at FROM calendar_account
                WHERE user_id = :user ORDER BY created_at, id
                """,
            ).param("user", user)
            .query { rs, _ ->
                CalendarAccount(
                    rs.uuid("id"),
                    rs.getString("provider"),
                    rs.getString("email"),
                    rs.getString("status"),
                    rs.longOrNull("synced_at"),
                )
            }.list()

    fun connected(user: Long, id: UUID): ConnectedAccount? =
        jdbc
            .sql(
                """
                SELECT a.id, a.user_id, u.scope_id, a.refresh_token_enc, a.access_token_enc, a.expires_at, a.failures
                FROM calendar_account a JOIN app_user u ON u.id = a.user_id
                WHERE a.user_id = :user AND a.id = :id
                """,
            ).param("user", user)
            .param("id", id)
            .query { rs, _ ->
                ConnectedAccount(
                    rs.uuid("id"),
                    rs.getLong("user_id"),
                    rs.uuid("scope_id"),
                    rs.getString("refresh_token_enc"),
                    rs.getString("access_token_enc"),
                    rs.getLong("expires_at"),
                    rs.getInt("failures"),
                )
            }.optional()
            .orElse(null)

    fun accountFor(user: Long, provider: String, subject: String): UUID? =
        jdbc
            .sql(
                "SELECT id FROM calendar_account WHERE user_id = :user AND provider = :provider AND subject = :subject",
            )
            .param("user", user)
            .param("provider", provider)
            .param("subject", subject)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    fun insertAccount(
        id: UUID,
        user: Long,
        provider: String,
        subject: String,
        email: String?,
        refreshToken: String,
        accessToken: String,
        expiresAt: Long,
        now: Long,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO calendar_account
                  (id, user_id, provider, subject, email, refresh_token_enc, access_token_enc, expires_at, created_at)
                VALUES (:id, :user, :provider, :subject, :email, :refresh, :access, :expires, :now)
                """,
            ).param("id", id)
            .param("user", user)
            .param("provider", provider)
            .param("subject", subject)
            .param("email", email)
            .param("refresh", refreshToken)
            .param("access", accessToken)
            .param("expires", expiresAt)
            .param("now", now)
            .update()
    }

    fun reconnect(user: Long, id: UUID, email: String?, refreshToken: String?, accessToken: String, expiresAt: Long) {
        jdbc
            .sql(
                """
                UPDATE calendar_account
                SET email = COALESCE(:email, email), refresh_token_enc = COALESCE(:refresh, refresh_token_enc),
                    access_token_enc = :access, expires_at = :expires, status = 'active', failures = 0, next_sync_at = 0
                WHERE user_id = :user AND id = :id
                """,
            ).param("email", email)
            .param("refresh", refreshToken)
            .param("access", accessToken)
            .param("expires", expiresAt)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun saveAccess(user: Long, id: UUID, accessToken: String, expiresAt: Long, refreshToken: String?) {
        jdbc
            .sql(
                """
                UPDATE calendar_account
                SET access_token_enc = :access, expires_at = :expires,
                    refresh_token_enc = COALESCE(:refresh, refresh_token_enc)
                WHERE user_id = :user AND id = :id
                """,
            ).param("access", accessToken)
            .param("expires", expiresAt)
            .param("refresh", refreshToken)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun succeeded(user: Long, id: UUID, now: Long, next: Long) {
        jdbc
            .sql(
                """
                UPDATE calendar_account SET failures = 0, synced_at = :now, next_sync_at = :next
                WHERE user_id = :user AND id = :id
                """,
            ).param("now", now)
            .param("next", next)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun failed(user: Long, id: UUID, failures: Int, next: Long) {
        jdbc
            .sql(
                "UPDATE calendar_account SET failures = :failures, next_sync_at = :next WHERE user_id = :user AND id = :id",
            )
            .param("failures", failures)
            .param("next", next)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun needsReauth(user: Long, id: UUID) {
        jdbc
            .sql(
                """
                UPDATE calendar_account SET status = 'reauth', access_token_enc = NULL
                WHERE user_id = :user AND id = :id
                """,
            ).param("user", user)
            .param("id", id)
            .update()
    }

    /** Marks up to [limit] active accounts due at [now] as taken until [lease] and returns them as (user, id). */
    fun claimDue(now: Long, lease: Long, limit: Int): List<Pair<Long, UUID>> =
        jdbc
            .sql(
                """
                UPDATE calendar_account SET next_sync_at = :lease
                WHERE id IN (
                  SELECT id FROM calendar_account
                  WHERE status = 'active' AND next_sync_at <= :now
                  ORDER BY next_sync_at, id LIMIT :limit
                )
                RETURNING user_id, id
                """,
            ).param("lease", lease)
            .param("now", now)
            .param("limit", limit)
            .query { rs, _ -> rs.getLong("user_id") to rs.uuid("id") }
            .list()

    fun deleteAccount(user: Long, id: UUID): Int {
        jdbc
            .sql(
                """
                DELETE FROM calendar_event WHERE user_id = :user
                  AND source_id IN (SELECT id FROM calendar_source WHERE user_id = :user AND account_id = :id)
                """,
            ).param("user", user)
            .param("id", id)
            .update()
        jdbc
            .sql("DELETE FROM calendar_source WHERE user_id = :user AND account_id = :id")
            .param("user", user)
            .param("id", id)
            .update()
        return jdbc
            .sql("DELETE FROM calendar_account WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun sources(user: Long): List<CalendarSource> =
        jdbc
            .sql("$SOURCE WHERE user_id = :user ORDER BY position, id")
            .param("user", user)
            .query { rs, _ -> source(rs) }
            .list()

    fun source(user: Long, id: UUID): CalendarSource? =
        jdbc
            .sql("$SOURCE WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query { rs, _ -> source(rs) }
            .optional()
            .orElse(null)

    fun setVisible(user: Long, id: UUID, visible: Boolean): Int =
        jdbc
            .sql("UPDATE calendar_source SET visible = :visible WHERE user_id = :user AND id = :id")
            .param("visible", visible)
            .param("user", user)
            .param("id", id)
            .update()

    fun syncedSources(user: Long, account: UUID): List<SyncedSource> =
        jdbc
            .sql(
                """
                SELECT id, external_id, sync_token, full_synced_at FROM calendar_source
                WHERE user_id = :user AND account_id = :account ORDER BY position, id
                """,
            ).param("user", user)
            .param("account", account)
            .query { rs, _ ->
                SyncedSource(
                    rs.uuid("id"),
                    rs.getString("external_id"),
                    rs.getString("sync_token"),
                    rs.longOrNull("full_synced_at"),
                )
            }.list()

    fun upsertSource(
        id: UUID,
        user: Long,
        account: UUID,
        externalId: String,
        name: String,
        color: String,
        position: Int,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO calendar_source (id, user_id, account_id, external_id, name, color, position)
                VALUES (:id, :user, :account, :external, :name, :color, :position)
                ON CONFLICT (id) DO UPDATE SET name = excluded.name, color = excluded.color, position = excluded.position
                WHERE calendar_source.user_id = :user
                """,
            ).param("id", id)
            .param("user", user)
            .param("account", account)
            .param("external", externalId)
            .param("name", name)
            .param("color", color)
            .param("position", position)
            .update()
    }

    fun dropSourcesExcept(user: Long, account: UUID, keep: Collection<UUID>) {
        val stale =
            syncedSources(user, account).map { it.id }.filter { it !in keep }
        if (stale.isEmpty()) return
        jdbc
            .sql("DELETE FROM calendar_event WHERE user_id = :user AND source_id IN (:stale)")
            .param("user", user)
            .param("stale", stale)
            .update()
        jdbc
            .sql("DELETE FROM calendar_source WHERE user_id = :user AND id IN (:stale)")
            .param("user", user)
            .param("stale", stale)
            .update()
    }

    fun saveCursor(user: Long, source: UUID, syncToken: String?, fullSyncedAt: Long?) {
        jdbc
            .sql(
                """
                UPDATE calendar_source
                SET sync_token = :token, full_synced_at = COALESCE(:full, full_synced_at)
                WHERE user_id = :user AND id = :id
                """,
            ).param("token", syncToken)
            .param("full", fullSyncedAt)
            .param("user", user)
            .param("id", source)
            .update()
    }

    fun upsertEvent(id: UUID, user: Long, source: UUID, event: ProviderEvent) {
        jdbc
            .sql(
                """
                INSERT INTO calendar_event
                  (id, user_id, source_id, external_id, title, start_at, end_at, all_day, location, link, status, updated_at)
                VALUES (:id, :user, :source, :external, :title, :start, :end, :allDay, :location, :link, :status, :updated)
                ON CONFLICT (id) DO UPDATE SET
                  title = excluded.title, start_at = excluded.start_at, end_at = excluded.end_at,
                  all_day = excluded.all_day, location = excluded.location, link = excluded.link,
                  status = excluded.status, updated_at = excluded.updated_at
                WHERE calendar_event.user_id = :user
                """,
            ).param("id", id)
            .param("user", user)
            .param("source", source)
            .param("external", event.id)
            .param("title", event.title)
            .param("start", event.start)
            .param("end", event.end)
            .param("allDay", event.allDay)
            .param("location", event.location)
            .param("link", event.link)
            .param("status", event.status)
            .param("updated", event.updated)
            .update()
    }

    fun deleteEvent(user: Long, source: UUID, externalId: String) {
        jdbc
            .sql("DELETE FROM calendar_event WHERE user_id = :user AND source_id = :source AND external_id = :external")
            .param("user", user)
            .param("source", source)
            .param("external", externalId)
            .update()
    }

    fun deleteEventsExcept(user: Long, source: UUID, keep: Collection<String>) {
        val stale =
            jdbc
                .sql("SELECT external_id FROM calendar_event WHERE user_id = :user AND source_id = :source")
                .param("user", user)
                .param("source", source)
                .query(String::class.java)
                .list()
                .filter { it !in keep }
        if (stale.isEmpty()) return
        jdbc
            .sql("DELETE FROM calendar_event WHERE user_id = :user AND source_id = :source AND external_id IN (:stale)")
            .param("user", user)
            .param("source", source)
            .param("stale", stale)
            .update()
    }

    fun events(user: Long, zone: ZoneId, from: LocalDate, to: LocalDate): List<CalendarEvent> =
        jdbc
            .sql(
                """
                SELECT e.id, e.source_id, s.name, s.color, e.title, e.start_at, e.end_at, e.all_day, e.location,
                       e.link, e.status
                FROM calendar_event e JOIN calendar_source s ON s.id = e.source_id AND s.user_id = :user
                WHERE e.user_id = :user AND s.visible AND e.status <> 'cancelled'
                  AND CASE WHEN e.all_day THEN e.start_at < :toDay AND e.end_at > :fromDay
                           ELSE e.start_at < :to AND e.end_at > :from END
                ORDER BY e.all_day DESC, e.start_at, s.position, e.id
                """,
            ).param("user", user)
            .param("from", from.atStartOfDay(zone).toEpochSecond())
            .param("to", to.atStartOfDay(zone).toEpochSecond())
            .param("fromDay", from.atStartOfDay(ZoneOffset.UTC).toEpochSecond())
            .param("toDay", to.atStartOfDay(ZoneOffset.UTC).toEpochSecond())
            .query { rs, _ ->
                val allDay = rs.getBoolean("all_day")
                val days = { column: String -> LocalDate.ofEpochDay(Math.floorDiv(rs.getLong(column), DAY)) }
                val startDate = if (allDay) days("start_at") else null
                val endDate = if (allDay) days("end_at") else null
                CalendarEvent(
                    id = rs.uuid("id"),
                    sourceId = rs.uuid("source_id"),
                    sourceName = rs.getString("name"),
                    color = rs.getString("color"),
                    title = rs.getString("title"),
                    startAt = startDate?.atStartOfDay(zone)?.toEpochSecond() ?: rs.getLong("start_at"),
                    endAt = endDate?.atStartOfDay(zone)?.toEpochSecond() ?: rs.getLong("end_at"),
                    allDay = allDay,
                    startDate = startDate,
                    endDate = endDate,
                    location = rs.getString("location"),
                    link = rs.getString("link"),
                    tentative = rs.getString("status") == "tentative",
                )
            }.list()

    private fun source(rs: java.sql.ResultSet) =
        CalendarSource(
            rs.uuid("id"),
            rs.uuid("account_id"),
            rs.getString("name"),
            rs.getString("color"),
            rs.getBoolean("visible"),
            rs.getInt("position"),
        )

    private companion object {
        const val SOURCE = "SELECT id, account_id, name, color, visible, position FROM calendar_source"
        const val DAY = 86_400L
    }
}
