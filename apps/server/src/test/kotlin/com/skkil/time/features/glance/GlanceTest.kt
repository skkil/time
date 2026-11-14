package com.skkil.time.features.glance

import com.skkil.time.features.tasks.api.TaskMust
import com.skkil.time.features.time.domain.BlockSpan
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GlanceTest : TaskApiTest() {
    @Test
    fun `shows the block under way and the next one today`() {
        val now = Instant.now().epochSecond / 60 * 60
        val write = create(input("Write")).id()
        val read = create(input("Read")).id()
        postJson("/api/v1/tasks/$write/blocks", BlockSpan(now - 600, now + 600))
        postJson("/api/v1/tasks/$read/blocks", BlockSpan(now + 60, now + 120))

        val glance = getJson("/api/v1/glance")
        assertEquals("block", glance["now"]["kind"].asString())
        assertEquals("Write", glance["now"]["title"].asString())
        assertEquals("Read", glance["next"]["title"].asString())
        assertTrue(glance["timer"].isNull)
    }

    @Test
    fun `lists musts and counts work left from earlier days`() {
        val today = today()
        val thesis = create(input("Thesis")).id()
        putJson("/api/v1/tasks/$thesis/must", TaskMust(today))
        create(input("Overdue").copy(dueDate = today.minusDays(2)))
        val done = create(input("Done").copy(dueDate = today.minusDays(3))).id()
        complete(done)

        val glance = getJson("/api/v1/glance")
        assertEquals(listOf("Thesis"), glance["musts"].values().map { it["title"].asString() })
        assertEquals(1, glance["earlierCount"].asInt())
    }
}
