package com.skkil.time.features.settings

import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals

class SettingsTest : ApiTest() {
    private fun enabled(path: String) = getJson("/api/v1/settings/$path").asBoolean()

    @Test
    fun `switches stay on until turned off`() {
        for (path in listOf("capture-hotkey", "reminders")) {
            assertEquals(true, enabled(path))
            put("/api/v1/settings/$path", Enabled(false)).andExpect { status { isNoContent() } }
            assertEquals(false, enabled(path))
            put("/api/v1/settings/$path", Enabled(true))
            assertEquals(true, enabled(path))
        }
    }

    @Test
    fun `each user has their own switches`() {
        put("/api/v1/settings/reminders", Enabled(false))
        subject = UUID.randomUUID().toString()
        assertEquals(true, enabled("reminders"))
    }
}
