package com.skkil.time.features.mutations.domain

import com.skkil.time.features.data.domain.LocalData
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

class MutationArgsTest {
    private val mapper = SqliteBooleans.mapper(JsonMapper.builder().addModule(kotlinModule()).build())

    @Test
    fun `local data keeps rows whose columns are null`() {
        val args =
            mapper.readTree(
                """
                {"data": {"tables": [
                  {"table": "project", "rows": []},
                  {"table": "task", "rows": [{"id": "01a1bea0-d2b5-743e-8656-b414e3287288", "title": "Offline",
                    "completed_at": null, "counts_as_time": 0, "position": 1}]}
                ]}}
                """,
            )

        val data = MutationArgs(args, mapper).get<LocalData>("data")

        val row = data.tables.single { it.table == "task" }.rows.single()
        assertEquals("Offline", row["title"]?.asString())
        assertTrue(row.get("completed_at").isNull)
    }
}
