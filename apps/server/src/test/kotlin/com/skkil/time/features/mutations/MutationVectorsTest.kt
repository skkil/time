package com.skkil.time.features.mutations

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.web.Caller
import com.skkil.time.features.mutations.domain.MutationDispatcher
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import tools.jackson.databind.JsonNode
import java.io.File
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Replays `apps/shared/client/src/types/mutation-vectors.json`, which the desktop's `time-core` replays too: the same
 * mutations with the same clock and ids must leave the same rows on both sides.
 */
class MutationVectorsTest : TaskApiTest() {
    @Autowired lateinit var mutations: MutationDispatcher

    private val vectors by lazy { mapper.readTree(File("../shared/client/src/types/mutation-vectors.json")) }

    private fun row(table: String, id: UUID): Map<String, Any?>? =
        jdbc
            .sql("SELECT * FROM $table WHERE id = :id")
            .param("id", id)
            .query {
                rs,
                _,
                ->
                (1..rs.metaData.columnCount).associate { rs.metaData.getColumnName(it) to rs.getObject(it) }
            }
            .optional()
            .orElse(null)

    private fun matches(want: JsonNode, got: Any?): Boolean =
        when {
            want.isNull -> got == null
            want.isBoolean -> got == want.asBoolean()
            want.isIntegralNumber -> (got as? Number)?.toLong() == want.asLong()
            want.isNumber -> (got as? Number)?.toDouble() == want.asDouble()
            else -> got?.toString() == want.asString()
        }

    @Test
    fun `replaying the shared vectors leaves the expected rows`() {
        val user = userId()
        val scope = UUID.fromString(vectors["scope"].asString())
        val mismatches = mutableListOf<String>()
        for ((index, step) in vectors["steps"].values().withIndex()) {
            val name = step["name"].asString()
            val label = "step $index ($name)"
            val at = OffsetDateTime.parse((step["at"] ?: vectors["at"]).asString())
            val ids = ArrayDeque(step["ids"].values().map { UUID.fromString(it.asString()) })
            val caller = Caller(user, scope, at.offset)
            asServer {
                mutations.dispatch(
                    caller,
                    name,
                    step["args"],
                    MutationClock.fixed(at.toInstant()),
                    IdGenerator { checkNotNull(ids.removeFirstOrNull()) { "$label draws more ids than it lists" } },
                )
            }
            assertTrue(ids.isEmpty(), "$label draws fewer ids than it lists")
            for (expected in step["expect"].values()) {
                val table = expected["table"].asString()
                val actual = row(table, UUID.fromString(expected["id"].asString()))
                if (actual == null) {
                    mismatches += "$label: no $table row ${expected["id"].asString()}"
                    continue
                }
                for ((column, want) in expected["row"].properties()) {
                    if (column !in actual) {
                        mismatches += "$label: $table has no $column"
                    } else if (!matches(want, actual[column])) {
                        mismatches += "$label: $table.$column is ${actual[column]}, not $want"
                    }
                }
            }
            for (gone in step.path("gone").values()) {
                val table = gone["table"].asString()
                if (row(table, UUID.fromString(gone["id"].asString())) != null) {
                    mismatches += "$label: $table ${gone["id"].asString()} is still there"
                }
            }
        }
        assertEquals(emptyList(), mismatches)
    }
}
