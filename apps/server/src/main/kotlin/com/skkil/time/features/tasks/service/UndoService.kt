package com.skkil.time.features.tasks.service

import com.skkil.time.common.error.invalid
import com.skkil.time.common.id.NaturalIds
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.tasks.domain.SnapshotCreated
import com.skkil.time.features.tasks.domain.SnapshotDependency
import com.skkil.time.features.tasks.domain.SnapshotLink
import com.skkil.time.features.tasks.domain.SnapshotRows
import com.skkil.time.features.tasks.domain.TaskSnapshot
import com.skkil.time.features.tasks.repository.TaskRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import java.util.UUID

/**
 * Undo for task changes. Capturing reads a [TaskSnapshot] and stores nothing; the client keeps it and sends it back
 * as `restoreTasks`, a mutation every device replays. Only columns this server knows are restored, the owner is
 * always the caller, and every reference must be the caller's.
 */
@Service
@Transactional
class UndoService(
    private val jdbc: JdbcClient,
    private val tasks: TaskRepository,
    private val mapper: JsonMapper,
) {
    private val columns: Map<String, List<String>> by lazy {
        jdbc
            .sql(
                """
                SELECT table_name, column_name FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name IN ('task', 'time_block', 'record_phase')
                ORDER BY ordinal_position
                """,
            ).query { rs, _ -> rs.getString("table_name") to rs.getString("column_name") }
            .list()
            .groupBy({ it.first }, { it.second })
    }

    @Transactional(readOnly = true)
    fun capture(caller: Caller, ids: List<UUID>): TaskSnapshot {
        val subtree = ids.flatMap { listOf(it) + tasks.descendants(caller.id, it) }.distinct().toTypedArray()
        val user = caller.id
        val taskRows = rows(TASK, "t.user_id = :user AND t.id = ANY(:ids)", user, subtree)
        return TaskSnapshot(
            tasks = taskRows,
            created =
                jdbc
                    .sql("SELECT id, created_at FROM task WHERE user_id = :user AND id = ANY(:ids)")
                    .param("user", user)
                    .param("ids", subtree)
                    .query { rs, _ -> SnapshotCreated(rs.uuid("id"), rs.getLong("created_at")) }
                    .list(),
            copies =
                listOf(
                    rows(BLOCK, "t.user_id = :user AND t.task_id = ANY(:ids)", user, subtree),
                    rows(
                        PHASE,
                        "t.task_id = ANY(:ids) AND EXISTS (SELECT 1 FROM task o WHERE o.id = t.task_id AND o.user_id = :user)",
                        user,
                        subtree,
                    ),
                ),
            dependencies =
                jdbc
                    .sql(
                        """
                        SELECT d.task_id, d.blocked_by_id FROM task_dependency d JOIN task t ON t.id = d.task_id
                        WHERE t.user_id = :user AND (d.task_id = ANY(:ids) OR d.blocked_by_id = ANY(:ids))
                        ORDER BY d.task_id, d.blocked_by_id
                        """,
                    ).param("user", user)
                    .param("ids", subtree)
                    .query { rs, _ -> SnapshotDependency(rs.uuid("task_id"), rs.uuid("blocked_by_id")) }
                    .list(),
            links =
                LINKED.flatMap { table ->
                    jdbc
                        .sql("SELECT id, task_id FROM $table WHERE user_id = :user AND task_id = ANY(:ids) ORDER BY id")
                        .param("user", user)
                        .param("ids", subtree)
                        .query { rs, _ -> SnapshotLink(table, rs.uuid("id"), rs.uuid("task_id")) }
                        .list()
                },
        )
    }

    fun restore(caller: Caller, snapshot: TaskSnapshot) {
        val user = caller.id
        if (snapshot.tasks.table != TASK) invalid("That isn't a task snapshot.")
        val ids = snapshot.created.map { it.id }.toSet()
        if (idsTaken(user, snapshot.created)) invalid("A newer task took its place, so this can't be undone.")
        try {
            write(caller, snapshot.tasks, ids, upsert = true)
            snapshot.copies.forEach { rows ->
                if (rows.table !in COPIED) invalid("That isn't a task snapshot.")
                write(caller, rows, ids, upsert = false)
            }
        } catch (_: DataIntegrityViolationException) {
            invalid(GONE)
        }
        if (foreignReferences(user, ids.toTypedArray())) invalid(GONE)
        snapshot.dependencies.forEach { addDependency(caller, it) }
        snapshot.links.filter { it.table in LINKED && it.taskId in ids }.forEach { link ->
            jdbc
                .sql("UPDATE ${link.table} SET task_id = :task WHERE id = :id AND user_id = :user AND task_id IS NULL")
                .param("task", link.taskId)
                .param("id", link.id)
                .param("user", user)
                .update()
        }
    }

    private fun rows(table: String, filter: String, user: Long, ids: Array<UUID>): SnapshotRows {
        val names = columns.getValue(table) - SERVER_ONLY
        val values =
            jdbc
                .sql("SELECT to_jsonb(t)::TEXT FROM $table t WHERE $filter ORDER BY t.id")
                .param("user", user)
                .param("ids", ids)
                .query(String::class.java)
                .list()
                .map { json ->
                    val row = mapper.readTree(json)
                    mapper.createArrayNode().apply { names.forEach { name -> add(row.get(name)) } }
                }
        return SnapshotRows(table, names, values)
    }

    private fun write(caller: Caller, rows: SnapshotRows, ids: Set<UUID>, upsert: Boolean) {
        val known = columns.getValue(rows.table)
        val kept = rows.columns.withIndex().filter { (_, name) -> name in known && name !in SERVER_ONLY }
        val names =
            kept.map { it.value } + listOfNotNull(USER.takeIf { it in known }, ID.takeIf { ID !in rows.columns })
        val list = names.joinToString { "\"$it\"" }
        val conflict =
            if (upsert) {
                "ON CONFLICT (id) DO UPDATE SET " +
                    names.filter { it != ID }.joinToString { "\"$it\" = excluded.\"$it\"" } +
                    " WHERE ${rows.table}.user_id = :user"
            } else {
                "ON CONFLICT DO NOTHING"
            }
        val parsed =
            rows.values.map { values ->
                kept
                    .associate { (index, name) ->
                        name to
                            values.get(index)?.takeUnless {
                                it.isNull
                            }?.let { mapper.treeToValue(it, Any::class.java) }
                    }.toMutableMap()
            }
        for (row in parentsFirst(parsed)) {
            val task = if (rows.table == TASK) row[ID] else row[TASK_ID]
            if (task == null || UUID.fromString(task.toString()) !in ids) invalid("That isn't a task snapshot.")
            if (USER in known) row[USER] = caller.id
            if (ID !in rows.columns) row[ID] = newId(caller, rows.table, row)
            jdbc
                .sql(
                    """
                    INSERT INTO ${rows.table} ($list)
                    SELECT $list FROM jsonb_populate_record(NULL::${rows.table}, CAST(:row AS JSONB))
                    $conflict
                    """,
                ).param("row", mapper.writeValueAsString(row))
                .param("user", caller.id)
                .update()
        }
    }

    private fun newId(caller: Caller, table: String, row: Map<String, Any?>): UUID =
        if (table == PHASE) {
            NaturalIds.recordPhase(caller.scopeId, uuidOf(row[TASK_ID]), uuidOf(row[STATUS_ID]))
        } else {
            caller.nextId()
        }

    private fun uuidOf(value: Any?): UUID {
        if (value == null) invalid("That isn't a task snapshot.")
        return UUID.fromString(value.toString())
    }

    private fun parentsFirst(rows: List<MutableMap<String, Any?>>): List<MutableMap<String, Any?>> {
        val pending = rows.toMutableList()
        val ordered = mutableListOf<MutableMap<String, Any?>>()
        while (pending.isNotEmpty()) {
            val waiting = pending.mapNotNull { it[ID]?.toString() }.toSet()
            val ready = pending.filter { it[PARENT]?.toString() !in waiting }.ifEmpty { pending.toList() }
            ordered += ready
            pending -= ready.toSet()
        }
        return ordered
    }

    private fun addDependency(caller: Caller, dependency: SnapshotDependency) {
        jdbc
            .sql(
                """
                INSERT INTO task_dependency (id, task_id, blocked_by_id)
                SELECT :id, :task, :blocker
                WHERE EXISTS (SELECT 1 FROM task WHERE id = :task AND user_id = :user)
                  AND EXISTS (SELECT 1 FROM task WHERE id = :blocker AND user_id = :user)
                ON CONFLICT DO NOTHING
                """,
            ).param("id", NaturalIds.taskDependency(caller.scopeId, dependency.taskId, dependency.blockedById))
            .param("task", dependency.taskId)
            .param("blocker", dependency.blockedById)
            .param("user", caller.id)
            .update()
    }

    private fun idsTaken(user: Long, created: List<SnapshotCreated>): Boolean =
        created.any { (id, createdAt) ->
            jdbc
                .sql("SELECT EXISTS(SELECT 1 FROM task WHERE id = :id AND (created_at <> :at OR user_id <> :user))")
                .param("id", id)
                .param("at", createdAt)
                .param("user", user)
                .query(Boolean::class.java)
                .single()
        }

    private fun foreignReferences(user: Long, ids: Array<UUID>): Boolean =
        jdbc
            .sql(
                """
                SELECT EXISTS(
                  SELECT 1 FROM task t WHERE t.id = ANY(:ids) AND (
                    (t.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM project x WHERE x.id = t.project_id AND x.user_id = :user))
                    OR (t.section_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM section x WHERE x.id = t.section_id AND x.user_id = :user))
                    OR (t.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task x WHERE x.id = t.parent_id AND x.user_id = :user))
                    OR (t.type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM item_type x WHERE x.id = t.type_id AND x.user_id = :user))
                    OR (t.status_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM item_status x WHERE x.id = t.status_id AND x.user_id = :user))
                    OR (t.milestone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM milestone x WHERE x.id = t.milestone_id AND x.user_id = :user))
                    OR (t.outcome_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM outcome x WHERE x.id = t.outcome_id AND x.user_id = :user))
                    OR (t.phase_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM item_status x WHERE x.id = t.phase_id AND x.user_id = :user))
                  )
                  OR EXISTS (
                    SELECT 1 FROM record_phase r WHERE r.task_id = ANY(:ids)
                      AND NOT EXISTS (SELECT 1 FROM item_status x WHERE x.id = r.status_id AND x.user_id = :user)
                  )
                )
                """,
            ).param("ids", ids)
            .param("user", user)
            .query(Boolean::class.java)
            .single()

    private companion object {
        const val TASK = "task"
        const val BLOCK = "time_block"
        const val PHASE = "record_phase"
        const val ID = "id"
        const val USER = "user_id"
        const val TASK_ID = "task_id"
        const val STATUS_ID = "status_id"
        const val PARENT = "parent_id"
        const val GONE = "Its project or section is gone, so this can't be undone."
        val COPIED = setOf(BLOCK, PHASE)
        val LINKED = listOf("time_entry", "ritual_run")
        val SERVER_ONLY = setOf(USER, "reminded_for")
    }
}
