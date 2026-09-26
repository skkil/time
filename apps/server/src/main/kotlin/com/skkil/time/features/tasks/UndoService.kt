package com.skkil.time.features.tasks

import com.skkil.time.common.Caller
import com.skkil.time.common.invalid
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Snapshots of tasks with their sub-tasks, blocks, phase notes, dependencies and links from time entries and ritual
 * runs, so a change can be undone. Each user keeps the latest [KEPT_SNAPSHOTS]; restoring one uses it up.
 */
@Service
@Transactional
class UndoService(private val jdbc: JdbcClient, private val tasks: TaskRepository) {
    private val taskAssignments by lazy {
        jdbc
            .sql(
                """
                SELECT string_agg(format('%I = excluded.%I', column_name, column_name), ', ' ORDER BY ordinal_position)
                FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = 'task' AND column_name <> 'id'
                """,
            ).query(String::class.java)
            .single()
    }

    fun capture(caller: Caller, ids: List<Long>): Long {
        val subtree = ids.flatMap { listOf(it) + tasks.descendants(caller.id, it) }.joinToString(",")
        val id =
            jdbc
                .sql(
                    """
                    WITH ids AS (SELECT unnest(string_to_array(:ids, ',')::BIGINT[]) AS id)
                    INSERT INTO undo_snapshot (user_id, payload, created_at)
                    SELECT :user, jsonb_build_object(
                      'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM task t
                                          WHERE t.user_id = :user AND t.id IN (SELECT id FROM ids)), '[]'),
                      'blocks', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM time_block b
                                           WHERE b.user_id = :user AND b.task_id IN (SELECT id FROM ids)), '[]'),
                      'phases', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM record_phase r
                                           JOIN task t ON t.id = r.task_id
                                           WHERE t.user_id = :user AND r.task_id IN (SELECT id FROM ids)), '[]'),
                      'dependencies', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM task_dependency d
                                                 JOIN task t ON t.id = d.task_id
                                                 WHERE t.user_id = :user AND (d.task_id IN (SELECT id FROM ids)
                                                   OR d.blocked_by_id IN (SELECT id FROM ids))), '[]'),
                      'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'task_id', e.task_id))
                                            FROM time_entry e
                                            WHERE e.user_id = :user AND e.task_id IN (SELECT id FROM ids)), '[]'),
                      'runs', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'task_id', r.task_id))
                                         FROM ritual_run r
                                         WHERE r.user_id = :user AND r.task_id IN (SELECT id FROM ids)), '[]')
                    ), :now
                    RETURNING id
                    """,
                ).param("ids", subtree)
                .param("user", caller.id)
                .param("now", caller.now())
                .query(Long::class.java)
                .single()
        jdbc
            .sql(
                """
                DELETE FROM undo_snapshot WHERE user_id = :user AND id NOT IN (
                  SELECT id FROM undo_snapshot WHERE user_id = :user ORDER BY id DESC LIMIT :kept)
                """,
            ).param("user", caller.id)
            .param("kept", KEPT_SNAPSHOTS)
            .update()
        return id
    }

    fun restore(user: Long, snapshot: Long) {
        val payload =
            jdbc
                .sql("DELETE FROM undo_snapshot WHERE user_id = :user AND id = :id RETURNING payload::TEXT")
                .param("user", user)
                .param("id", snapshot)
                .query(String::class.java)
                .optional()
                .orElse(null) ?: invalid("This can no longer be undone.")
        if (idsTaken(user, payload)) invalid("A newer task took its place, so this can't be undone.")
        try {
            write(user, payload)
        } catch (_: DataIntegrityViolationException) {
            invalid("Its project or section is gone, so this can't be undone.")
        }
    }

    private fun idsTaken(user: Long, payload: String): Boolean =
        jdbc
            .sql(
                """
                SELECT EXISTS(
                  SELECT 1 FROM jsonb_to_recordset(CAST(:payload AS JSONB) -> 'tasks') AS s(id BIGINT, created_at BIGINT)
                  JOIN task t ON t.id = s.id
                  WHERE t.created_at <> s.created_at OR t.user_id <> :user)
                """,
            ).param("payload", payload)
            .param("user", user)
            .query(Boolean::class.java)
            .single()

    private fun write(user: Long, payload: String) {
        val statements =
            listOf(
                """
                INSERT INTO task OVERRIDING SYSTEM VALUE
                SELECT * FROM jsonb_populate_recordset(NULL::task, CAST(:payload AS JSONB) -> 'tasks')
                ON CONFLICT (id) DO UPDATE SET $taskAssignments
                """,
                """
                INSERT INTO time_block OVERRIDING SYSTEM VALUE
                SELECT * FROM jsonb_populate_recordset(NULL::time_block, CAST(:payload AS JSONB) -> 'blocks')
                ON CONFLICT DO NOTHING
                """,
                """
                INSERT INTO record_phase
                SELECT * FROM jsonb_populate_recordset(NULL::record_phase, CAST(:payload AS JSONB) -> 'phases')
                ON CONFLICT DO NOTHING
                """,
                """
                INSERT INTO task_dependency (task_id, blocked_by_id)
                SELECT d.task_id, d.blocked_by_id
                FROM jsonb_to_recordset(CAST(:payload AS JSONB) -> 'dependencies') AS d(task_id BIGINT, blocked_by_id BIGINT)
                WHERE EXISTS (SELECT 1 FROM task WHERE id = d.task_id AND user_id = :user)
                  AND EXISTS (SELECT 1 FROM task WHERE id = d.blocked_by_id AND user_id = :user)
                ON CONFLICT DO NOTHING
                """,
                """
                UPDATE time_entry e SET task_id = l.task_id
                FROM jsonb_to_recordset(CAST(:payload AS JSONB) -> 'entries') AS l(id BIGINT, task_id BIGINT)
                WHERE e.id = l.id AND e.user_id = :user AND e.task_id IS NULL
                """,
                """
                UPDATE ritual_run r SET task_id = l.task_id
                FROM jsonb_to_recordset(CAST(:payload AS JSONB) -> 'runs') AS l(id BIGINT, task_id BIGINT)
                WHERE r.id = l.id AND r.user_id = :user AND r.task_id IS NULL
                """,
            )
        for (sql in statements) {
            jdbc.sql(sql).params(mapOf("payload" to payload, "user" to user)).update()
        }
    }

    private companion object {
        const val KEPT_SNAPSHOTS = 50
    }
}
