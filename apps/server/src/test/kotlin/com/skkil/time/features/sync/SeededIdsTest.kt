package com.skkil.time.features.sync

import com.skkil.time.common.id.UuidV5
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals

class SeededIdsTest : ApiTest() {
    private fun rituals(): Map<String, UUID> =
        jdbc
            .sql("SELECT kind, id FROM ritual WHERE user_id = :user")
            .param("user", userId())
            .query { rs, _ -> rs.getString("kind") to rs.getObject("id", UUID::class.java) }
            .list()
            .toMap()

    private fun expected(): Map<String, UUID> =
        listOf("morning", "evening", "wind_down", "session", "weekly").associateWith {
            UuidV5.of(scopeId(), "ritual/$it")
        }

    @Test
    fun `default rituals are named by the scope and kind`() {
        assertEquals(expected(), rituals())
    }

    @Test
    fun `deleting everything seeds the same ids again`() {
        delete("/api/v1/data").andExpect { status { isNoContent() } }
        assertEquals(expected(), rituals())
    }
}
