package com.skkil.time.migration

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * time's copies of store's SQL (V9, V10, ...) are byte for byte the migrations of the pinned store checkout, each
 * under a header naming the store tag it was copied at, which is never newer than the pinned one.
 */
class StoreMigrationsTest {
    private val pinned = File("../../STORE_VERSION").readText().trim()
    private val store = File(System.getProperty("store.dir"), "modules/sql/migrations")
    private val copies =
        File("src/main/resources/db/migration").listFiles { file -> file.name.contains("__store_v") }!!.associateBy {
            it.name.substringAfter("__store_v").substringBefore(".sql").toInt()
        }

    @Test
    fun `copies every store migration unchanged under a header naming the tag`() {
        val originals =
            store.listFiles { file -> file.name.matches(Regex("V\\d+__.+\\.sql")) }!!.associateBy {
                it.name.substringAfter('V').substringBefore("__").toInt()
            }
        assertEquals(originals.keys, copies.keys, "store migrations in $store")
        for ((version, original) in originals) {
            val copy = copies.getValue(version).readBytes()
            val firstLine = copy.decodeToString().substringBefore('\n')
            val header = HEADER.matchEntire(firstLine)
            assertNotNull(header, "header of the copy of ${original.name}: $firstLine")
            val (tag, name) = header.destructured
            assertEquals(original.name, name)
            assertTrue(semver(tag) <= semver(pinned), "${original.name} names $tag, newer than the pinned $pinned")
            assertContentEquals(original.readBytes(), copy.copyOfRange(firstLine.toByteArray().size + 1, copy.size))
        }
    }

    private fun semver(tag: String): Long =
        tag.removePrefix("v").split('.').map(String::toLong).fold(0L) { total, part -> total * 100_000 + part }

    private companion object {
        val HEADER =
            Regex(
                """-- store (v\d+\.\d+\.\d+) modules/sql/migrations/(V\d+__.+\.sql), copied byte for byte below this line\.""",
            )
    }
}
