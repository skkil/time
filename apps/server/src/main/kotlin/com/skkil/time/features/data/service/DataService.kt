package com.skkil.time.features.data.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.invalid
import com.skkil.time.common.persistence.doubleOrNull
import com.skkil.time.common.persistence.intOrNull
import com.skkil.time.common.persistence.longOrNull
import com.skkil.time.common.web.Caller
import com.skkil.time.features.data.domain.Column
import com.skkil.time.features.data.domain.ColumnType
import com.skkil.time.features.data.domain.DataExport
import com.skkil.time.features.data.domain.TABLES
import com.skkil.time.features.data.domain.Table
import com.skkil.time.features.rituals.service.RitualDefaults
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.sql.ResultSet
import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID

/** Old id to new id for one table during a restore. */
private typealias IdMap = Map<String, UUID>

@Service
@Transactional
class DataService(private val jdbc: JdbcClient, private val mapper: JsonMapper, private val rituals: RitualDefaults) {
    @Transactional(readOnly = true)
    fun export(caller: Caller): DataExport =
        DataExport(FORMAT, VERSION, caller.now(), TABLES.associate { it.name to rows(caller.id, it) })

    /** Replaces all of the user's data with a backup. Every id is new, so links are remapped as rows go in. */
    fun restore(caller: Caller, text: String) {
        val backup = parse(text)
        try {
            wipe(caller.id)
            val ids = mutableMapOf<String, IdMap>()
            for (table in TABLES) ids[table.name] = insert(caller, table, backup[table.name].orEmpty(), ids)
            rituals.seed(caller.id, caller.scopeId)
        } catch (_: DataAccessException) {
            invalid(NOT_A_BACKUP)
        }
    }

    fun deleteAll(caller: Caller) {
        wipe(caller.id)
        rituals.seed(caller.id, caller.scopeId)
    }

    private fun rows(user: Long, table: Table): List<Map<String, Any?>> =
        jdbc
            .sql(
                """
                SELECT ${table.columns.joinToString { quoted(it.name) }} FROM ${table.name}
                WHERE ${table.owner ?: "user_id = :user"} ORDER BY 1
                """,
            ).param("user", user)
            .query { rs, _ -> table.columns.associate { it.name to rs.read(it) } }
            .list()

    private fun ResultSet.read(column: Column): Any? =
        when (column.type) {
            ColumnType.TEXT, ColumnType.DATE, ColumnType.UUID -> getString(column.name)
            ColumnType.BIGINT -> longOrNull(column.name)
            ColumnType.INT -> intOrNull(column.name)
            ColumnType.BOOL -> getObject(column.name, java.lang.Boolean::class.java)?.booleanValue()
            ColumnType.DOUBLE -> doubleOrNull(column.name)
        }

    private fun wipe(user: Long) {
        for (table in TABLES.asReversed().filter { it.ownedDirectly } + UNDO) {
            jdbc.sql("DELETE FROM ${table.name} WHERE user_id = :user").param("user", user).update()
        }
    }

    private fun parse(text: String): Map<String, List<JsonNode>> {
        val root =
            runCatching { mapper.readTree(text) }
                .getOrNull()
                ?.takeIf { it.isObject && it.path("format").asString("") == FORMAT }
                ?: invalid(NOT_A_BACKUP)
        val version = root.path("version")
        ensure(version.isIntegralNumber) { NOT_A_BACKUP }
        ensure(version.asLong() <= VERSION) { "That backup comes from a newer version of skkil time." }
        ensure(version.asLong() >= FIRST_VERSION && root.path("tables").isObject) { NOT_A_BACKUP }
        val known = TABLES.map { it.name }.toSet()
        return root.path("tables").properties().associate { (name, rows) ->
            ensure(name in known && rows.isArray && rows.all { it.isObject }) { NOT_A_BACKUP }
            name to rows.toList()
        }
    }

    private fun insert(caller: Caller, table: Table, rows: List<JsonNode>, ids: Map<String, IdMap>): IdMap {
        val user = caller.id
        val created = mutableMapOf<String, UUID>()
        val links = mutableListOf<Triple<UUID, Column, String>>()
        val columns = table.columns.filter { it.name != ID }
        val owner = if (table.ownedDirectly) listOf("user_id") else emptyList()
        val sql =
            """
            INSERT INTO ${table.name} (${(listOf(ID) + owner + columns.map { quoted(it.name) }).joinToString()})
            VALUES (${(listOf(ID) + owner + columns.map { it.name }).joinToString { ":$it" }})
            """
        for (row in rows) {
            val id =
                when (table.name) {
                    RITUAL -> rituals.idFor(caller.scopeId, row.path("kind").asString())
                    else -> caller.nextId()
                }
            var statement = jdbc.sql(sql).param(ID, id).param("user_id", user)
            val pending = mutableListOf<Pair<Column, String>>()
            for (column in columns) {
                val value = value(row.path(column.name), column)
                val linked =
                    when {
                        value == null || column.references == null -> value
                        column.references == table.name -> null.also { pending += column to value as String }
                        else -> ids[column.references]?.get(value) ?: invalid(NOT_A_BACKUP)
                    }
                statement = statement.param(column.name, linked)
            }
            statement.update()
            if (!table.identity) continue
            val old = value(row.path(ID), table.columns.first()) as? String ?: invalid(NOT_A_BACKUP)
            ensure(created.put(old, id) == null) { NOT_A_BACKUP }
            pending.forEach { (column, target) -> links += Triple(id, column, target) }
        }
        for ((id, column, target) in links) {
            jdbc
                .sql("UPDATE ${table.name} SET ${quoted(column.name)} = :target WHERE user_id = :user AND id = :id")
                .param("target", created[target] ?: invalid(NOT_A_BACKUP))
                .param("user", user)
                .param("id", id)
                .update()
        }
        return created
    }

    private fun value(node: JsonNode, column: Column): Any? {
        if (node.isMissingNode || node.isNull) return null
        val fits =
            when (column.type) {
                ColumnType.TEXT, ColumnType.DATE -> node.isString
                ColumnType.UUID -> node.isString || node.isIntegralNumber
                ColumnType.BIGINT -> node.isIntegralNumber && node.canConvertToLong()
                ColumnType.INT -> node.isIntegralNumber && node.canConvertToInt()
                ColumnType.BOOL -> node.isBoolean
                ColumnType.DOUBLE -> node.isNumber
            }
        ensure(fits) { NOT_A_BACKUP }
        return when (column.type) {
            ColumnType.TEXT -> {
                node.asString()
            }

            ColumnType.UUID -> {
                node.asString()
            }

            ColumnType.DATE -> {
                try {
                    LocalDate.parse(node.asString())
                } catch (_: DateTimeParseException) {
                    invalid(NOT_A_BACKUP)
                }
            }

            ColumnType.BIGINT -> {
                node.asLong()
            }

            ColumnType.INT -> {
                node.asInt()
            }

            ColumnType.BOOL -> {
                node.asBoolean()
            }

            ColumnType.DOUBLE -> {
                node.asDouble()
            }
        }
    }

    private fun quoted(name: String) = "\"$name\""

    private companion object {
        const val FORMAT = "skkil-time"
        const val VERSION = 2
        const val FIRST_VERSION = 1
        const val ID = "id"
        const val RITUAL = "ritual"
        const val NOT_A_BACKUP = "That file isn't a skkil time backup."
        val UNDO = Table("undo_snapshot", true, emptyList())
    }
}
