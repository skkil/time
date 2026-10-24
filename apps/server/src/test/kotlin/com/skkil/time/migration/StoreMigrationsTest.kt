package com.skkil.time.migration

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

/** time's copies of store's SQL (V9, V10, ...) are byte for byte the migrations of the pinned store checkout. */
class StoreMigrationsTest {
    private val tag = File("../../STORE_VERSION").readText().trim()
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
            val header =
                "-- store $tag modules/sql/migrations/${original.name}, copied byte for byte below this line.\n"
            assertEquals(header, copy.decodeToString().substringBefore('\n') + "\n")
            assertContentEquals(original.readBytes(), copy.copyOfRange(header.toByteArray().size, copy.size))
        }
    }
}
