package com.skkil.time.features.sync

import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import org.springframework.dao.DataAccessException
import java.sql.SQLException
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class StoreRegistrationTest : TaskApiTest() {
    private fun names(sql: String): Set<String> = jdbc.sql(sql).query(String::class.java).list().filterNotNull().toSet()

    @Test
    fun `every user table keyed by a uuid is registered, with the capture trigger`() {
        val uuidKeyed =
            names(
                """
                SELECT c.table_name FROM information_schema.columns c
                WHERE c.table_schema = current_schema() AND c.column_name = 'id' AND c.data_type = 'uuid'
                """,
            )
        val registered = names("SELECT table_name FROM store_table")
        val triggered = names("SELECT tgrelid::regclass::text FROM pg_trigger WHERE tgname = 'store_capture'")

        assertEquals(uuidKeyed, registered)
        assertEquals(registered, triggered)
        assertTrue("app_user" !in registered && "push_device" !in registered)
    }

    @Test
    fun `owner columns and server bookkeeping stay out of row images`() {
        val excluded =
            jdbc
                .sql("SELECT table_name, array_to_string(excluded_columns, ',') FROM store_table")
                .query { rs, _ -> rs.getString(1) to rs.getString(2) }
                .list()
                .toMap()
        assertEquals("user_id,reminded_for", excluded["task"])
        assertEquals("user_id", excluded["project"])
        assertEquals("", excluded["habit_log"])
    }

    @Test
    fun `a direct write outside the write path fails`() {
        val task = create(input("Read")).id()
        val error =
            assertFailsWith<DataAccessException> {
                jdbc.sql("UPDATE task SET title = 'Sneaky' WHERE id = :id").param("id", task).update()
            }
        val sql = generateSequence<Throwable>(error) { it.cause }.filterIsInstance<SQLException>().first()
        assertEquals("55000", sql.sqlState)
        assertEquals("Read", task(task)["title"].asString())
    }
}
