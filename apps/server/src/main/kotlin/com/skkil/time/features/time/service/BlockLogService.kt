package com.skkil.time.features.time.service

import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.settings.repository.SettingsRepository
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Ended focus blocks become tracked time on their task, once each, while the switch is on. */
@Service
@Transactional
class BlockLogService(private val jdbc: JdbcClient, private val settings: SettingsRepository) {
    fun enabled(user: Long): Boolean = settings.read(user, SETTING) != "off"

    fun setEnabled(caller: Caller, enabled: Boolean) = settings.write(caller, SETTING, if (enabled) "on" else "off")

    @Transactional(readOnly = true)
    fun countEnded(caller: Caller): Int = if (enabled(caller.id)) ended(caller.id, caller.now()).size else 0

    fun logEnded(caller: Caller): Int {
        if (!enabled(caller.id)) return 0
        var logged = 0
        for (block in ended(caller.id, caller.now())) {
            val tracked =
                jdbc
                    .sql(
                        """
                        SELECT EXISTS (SELECT 1 FROM time_entry
                          WHERE user_id = :user AND task_id = :task AND started_at < :end AND ended_at > :start)
                        """,
                    ).param("user", caller.id)
                    .param("task", block.taskId)
                    .param("start", block.startAt)
                    .param("end", block.endAt)
                    .query(Boolean::class.java)
                    .single()
            if (!tracked) {
                jdbc
                    .sql(
                        """
                        INSERT INTO time_entry (id, user_id, description, project_id, task_id, started_at, ended_at, source)
                        SELECT :id, t.user_id, t.title, t.project_id, t.id, :start, :end, 'block'
                        FROM task t WHERE t.user_id = :user AND t.id = :task
                        """,
                    ).param("id", caller.nextId())
                    .param("user", caller.id)
                    .param("task", block.taskId)
                    .param("start", block.startAt)
                    .param("end", block.endAt)
                    .update()
                logged++
            }
            jdbc
                .sql("UPDATE time_block SET logged = TRUE WHERE user_id = :user AND id = :id")
                .param("user", caller.id)
                .param("id", block.id)
                .update()
        }
        return logged
    }

    private fun ended(user: Long, now: Long): List<Ended> =
        jdbc
            .sql(
                """
                SELECT b.id, b.task_id, b.start_at, b.end_at
                FROM time_block b JOIN task t ON t.id = b.task_id
                WHERE b.user_id = :user AND NOT b.logged AND b.end_at <= :now AND b.end_at > :since
                  AND NOT t.someday
                  AND NOT EXISTS (SELECT 1 FROM running_timer r WHERE r.user_id = :user AND r.task_id = b.task_id)
                ORDER BY b.start_at, b.id
                """,
            ).param("user", user)
            .param("now", now)
            .param("since", now - LOOKBACK_SECONDS)
            .query { rs, _ -> Ended(rs.uuid("id"), rs.uuid("task_id"), rs.getLong("start_at"), rs.getLong("end_at")) }
            .list()

    private data class Ended(val id: UUID, val taskId: UUID, val startAt: Long, val endAt: Long)

    private companion object {
        const val SETTING = "auto_log_blocks"
        const val LOOKBACK_SECONDS = 2L * 24 * 60 * 60
    }
}
