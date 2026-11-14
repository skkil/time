package com.skkil.time.features.time

import com.skkil.time.features.time.domain.BlockSpan
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.test.assertEquals

class BlockTest : TaskApiTest() {
    private val monday = LocalDate.parse("2026-11-02")

    private fun blocks(from: LocalDate, to: LocalDate) = getJson("/api/v1/blocks?from=$from&to=$to")

    @Test
    fun `schedules tasks and cascades on delete`() {
        val task = create(input("Write intro")).id()
        val start = monday.atStartOfDay(ZoneId.of("UTC")).toEpochSecond() + 9 * 3600
        val block = postJson("/api/v1/tasks/$task/blocks", BlockSpan(start, start + 3600))
        assertEquals("Write intro", block["title"].asString())
        assertEquals(1, blocks(monday, monday.plusDays(7)).size())

        val moved = putJson("/api/v1/blocks/${block.id()}", BlockSpan(start + 3600, start + 7200))
        assertEquals(start + 3600, moved["startAt"].asLong())

        delete("/api/v1/tasks/$task").andExpect { status { isNoContent() } }
        assertEquals(0, blocks(monday, monday.plusDays(7)).size())
        expectProblem(delete("/api/v1/blocks/${block.id()}"), 404, "notFound")
    }

    @Test
    fun `moving a block to another day moves its dated task`() {
        val dated = create(input("Write intro").copy(dueDate = monday)).id()
        val undated = create(input("Read")).id()
        val nine = monday.atStartOfDay(ZoneId.of("UTC")).toEpochSecond() + 9 * 3600
        val first = postJson("/api/v1/tasks/$dated/blocks", BlockSpan(nine, nine + 3600)).id()
        val second = postJson("/api/v1/tasks/$undated/blocks", BlockSpan(nine, nine + 3600)).id()
        val tuesday = nine + 86_400

        putJson("/api/v1/blocks/$first", BlockSpan(tuesday, tuesday + 3600))
        putJson("/api/v1/blocks/$second", BlockSpan(tuesday, tuesday + 3600))

        assertEquals("2026-11-03", task(dated)["dueDate"].asString())
        assertEquals(true, task(undated)["dueDate"].isNull)
    }

    @Test
    fun `rejects bad spans`() {
        val task = create(input("Read")).id()
        expectProblem(post("/api/v1/tasks/$task/blocks", BlockSpan(7200, 3600)), 422, "invalid")
        expectProblem(post("/api/v1/tasks/$task/blocks", BlockSpan(3601, 7200)), 422, "invalid")
        expectProblem(post("/api/v1/tasks/$task/blocks", BlockSpan(0, 86_460)), 422, "invalid")
        expectProblem(post("/api/v1/tasks/${UUID.randomUUID()}/blocks", BlockSpan(0, 3600)), 404, "notFound")
    }

    @Test
    fun `days follow the caller's time zone`() {
        zone = "Asia/Seoul"
        val task = create(input("Late")).id()
        val start = monday.atStartOfDay(ZoneId.of("Asia/Seoul")).toEpochSecond()
        postJson("/api/v1/tasks/$task/blocks", BlockSpan(start, start + 3600))
        assertEquals(1, blocks(monday, monday.plusDays(1)).size())
        assertEquals(0, blocks(monday.minusDays(1), monday).size())
    }

    @Test
    fun `another user's blocks stay out of reach`() {
        val task = create(input("Mine")).id()
        val block = postJson("/api/v1/tasks/$task/blocks", BlockSpan(0, 3600)).id()
        subject = "someone-else"
        assertEquals(0, blocks(LocalDate.EPOCH, LocalDate.EPOCH.plusDays(1)).size())
        expectProblem(post("/api/v1/tasks/$task/blocks", BlockSpan(0, 3600)), 404, "notFound")
        expectProblem(put("/api/v1/blocks/$block", BlockSpan(0, 7200)), 404, "notFound")
        expectProblem(delete("/api/v1/blocks/$block"), 404, "notFound")
    }
}
