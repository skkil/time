package com.skkil.time.features.data.service

import com.skkil.time.common.error.conflict
import com.skkil.time.common.error.invalid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.data.domain.Column
import com.skkil.time.features.data.domain.ColumnType
import com.skkil.time.features.data.domain.LOCAL_TABLES
import com.skkil.time.features.data.domain.LocalData
import com.skkil.time.features.data.domain.LocalTable
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import tools.jackson.databind.JsonNode
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID

/** A row as uploaded, keyed by column name. */
private typealias Row = Map<String, JsonNode?>

/**
 * `importLocal`: writes a device's uploaded rows into the caller's account, as `time_core::data::import` does on a
 * device. Tables go in [LOCAL_TABLES] order and rows parents first.
 *
 * - Tables that don't sync are refused, and so is a row without a uuid id. Columns the server doesn't keep are
 *   ignored, and `user_id` is never read from a row.
 * - A natural-key row (a ritual's kind, a day, a setting, ...) takes its key's id in the caller's scope.
 * - A row whose id belongs to another account is refused. One whose id the account has takes the uploaded values.
 *   Otherwise a row whose natural key (a group's name, a quarter's start, an imported row's external id, ...) another
 *   of the account's rows holds merges into that row: it keeps its id, takes the uploaded values, and every later
 *   uploaded reference to the uploaded id follows it. Anything else is inserted with the id the device chose.
 * - Every reference must name a row of the caller's, uploaded or not.
 */
@Service
class LocalImportService(private val jdbc: JdbcClient) {
    fun import(caller: Caller, data: LocalData) {
        val known = LOCAL_TABLES.associateBy { it.name }
        data.tables.firstOrNull { it.table !in known }?.let { invalid("“${it.table}” can't be imported.") }
        val merged = mutableMapOf<Pair<String, UUID>, UUID>()
        for (table in LOCAL_TABLES) {
            for (rows in data.tables.filter { it.table == table.name }) {
                for (row in parentsFirst(table, rows.rows)) write(caller, table, row, merged)
            }
        }
    }

    private fun write(caller: Caller, table: LocalTable, row: Row, merged: MutableMap<Pair<String, UUID>, UUID>) {
        val sent =
            row["id"]?.takeIf { it.isString }?.asString()?.let(::uuidOrNull)
                ?: invalid("A ${table.name} row has no id.")
        val values = linkedMapOf<String, Any?>()
        for (column in table.columns.drop(1)) {
            if (!row.containsKey(column.name)) continue
            val value = value(table, column, row[column.name])
            val target = column.references
            values[column.name] =
                if (value is UUID && target != null) {
                    (merged[target to value] ?: value).also {
                        if (!owns(caller.id, target, it)) {
                            invalid("A ${table.name} row points at a $target that isn't there.")
                        }
                    }
                } else {
                    value
                }
        }
        val keyed = table.keyedId?.let { build -> key(table, values)?.let { build(caller.scopeId, it) } } ?: sent
        val owner = ownerOf(table, keyed)
        if (owner != null && owner != caller.id) conflict("That id is already taken.")
        val holder = if (owner == null) holder(caller.id, table, values) else null
        val id = holder ?: keyed
        if (id != sent) merged[table.name to sent] = id
        if (owner != null || holder != null) update(table, id, values) else insert(caller.id, table, id, values)
    }

    private fun value(table: LocalTable, column: Column, node: JsonNode?): Any? {
        if (node == null || node.isNull) return null

        fun wrong(): Nothing = invalid("A ${table.name} row's “${column.name}” isn't valid.")
        return when (column.type) {
            ColumnType.TEXT -> {
                if (node.isString) node.asString() else wrong()
            }

            ColumnType.UUID -> {
                if (node.isString) uuidOrNull(node.asString()) ?: wrong() else wrong()
            }

            ColumnType.DATE -> {
                if (node.isString) dateOrNull(node.asString()) ?: wrong() else wrong()
            }

            ColumnType.BIGINT -> {
                if (node.isIntegralNumber && node.canConvertToLong()) node.asLong() else wrong()
            }

            ColumnType.INT -> {
                if (node.isIntegralNumber && node.canConvertToInt()) node.asInt() else wrong()
            }

            ColumnType.DOUBLE -> {
                if (node.isNumber) node.asDouble() else wrong()
            }

            ColumnType.BOOL -> {
                when {
                    node.isBoolean -> node.asBoolean()
                    node.isIntegralNumber && node.asLong() in 0L..1L -> node.asLong() == 1L
                    else -> wrong()
                }
            }
        }
    }

    private fun key(table: LocalTable, values: Map<String, Any?>): List<Any>? =
        table.naturalKey?.map { values[it] ?: return null }

    private fun owns(user: Long, table: String, id: UUID): Boolean =
        jdbc
            .sql("SELECT EXISTS (SELECT 1 FROM $table WHERE id = :id AND user_id = :user)")
            .param("id", id)
            .param("user", user)
            .query(Boolean::class.java)
            .single()

    /** The account that owns the row [id] of [table], directly or through its parent row; `null` when there is none. */
    private fun ownerOf(table: LocalTable, id: UUID): Long? {
        val owner = table.owner
        val sql =
            if (owner == null) {
                "SELECT user_id FROM ${table.name} WHERE id = :id"
            } else {
                """
                SELECT p.user_id FROM ${table.name} t JOIN ${owner.references} p ON p.id = t.${owner.name}
                WHERE t.id = :id
                """
            }
        return jdbc.sql(sql).param("id", id).query(Long::class.java).optional().orElse(null)
    }

    /** The caller's row that already holds [values]' natural key, if any. */
    private fun holder(user: Long, table: LocalTable, values: Map<String, Any?>): UUID? {
        val key = key(table, values) ?: return null
        val names = table.naturalKey.orEmpty()
        val conditions =
            names.mapIndexed { index, name ->
                if (table.name == GROUP && name == "name") "lower(name) = lower(:k$index)" else "\"$name\" = :k$index"
            } + listOfNotNull("user_id = :user".takeIf { table.owner == null })
        var statement =
            jdbc.sql(
                "SELECT id FROM ${table.name} WHERE ${conditions.ifEmpty { listOf("TRUE") }.joinToString(" AND ")}",
            )
        key.forEachIndexed { index, value -> statement = statement.param("k$index", value) }
        if (table.owner == null) statement = statement.param("user", user)
        return statement.query(UUID::class.java).optional().orElse(null)
    }

    private fun insert(user: Long, table: LocalTable, id: UUID, values: Map<String, Any?>) {
        val owner = if (table.owner == null) listOf("user_id") else emptyList()
        val columns = listOf("id") + owner + values.keys
        val slots = listOf(":id") + owner.map { ":user" } + values.keys.indices.map { ":v$it" }
        var statement =
            jdbc
                .sql(
                    "INSERT INTO ${table.name} (${columns.joinToString {
                        "\"$it\""
                    }}) VALUES (${slots.joinToString()})",
                ).param("id", id)
        if (table.owner == null) statement = statement.param("user", user)
        values.values.forEachIndexed { index, value -> statement = statement.param("v$index", value) }
        statement.update()
    }

    private fun update(table: LocalTable, id: UUID, values: Map<String, Any?>) {
        if (values.isEmpty()) return
        val assignments = values.keys.mapIndexed { index, name -> "\"$name\" = :v$index" }
        var statement =
            jdbc.sql("UPDATE ${table.name} SET ${assignments.joinToString()} WHERE id = :id").param("id", id)
        values.values.forEachIndexed { index, value -> statement = statement.param("v$index", value) }
        statement.update()
    }

    /** [rows] reordered so a row comes after the row of the same table it points at, as the device orders them. */
    private fun parentsFirst(table: LocalTable, rows: List<Row>): List<Row> {
        val column = table.selfReference?.name ?: return rows

        fun text(row: Row, name: String) = row[name]?.takeIf { it.isString }?.asString()
        val present = rows.mapNotNull { text(it, "id") }.toSet()
        val placed = mutableSetOf<String>()
        val ordered = mutableListOf<Row>()
        var pending = rows
        while (pending.isNotEmpty()) {
            val (ready, waiting) =
                pending.partition { row -> text(row, column).let { it == null || it !in present || it in placed } }
            if (ready.isEmpty()) {
                ordered += waiting
                break
            }
            placed += ready.mapNotNull { text(it, "id") }
            ordered += ready
            pending = waiting
        }
        return ordered
    }

    private fun uuidOrNull(text: String): UUID? =
        try {
            UUID.fromString(text).takeIf { it.toString() == text.lowercase() }
        } catch (_: IllegalArgumentException) {
            null
        }

    private fun dateOrNull(text: String): LocalDate? =
        try {
            LocalDate.parse(text)
        } catch (_: DateTimeParseException) {
            null
        }

    private companion object {
        const val GROUP = "project_group"
    }
}
