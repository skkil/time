package com.skkil.time.common.id

import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class UuidV7GeneratorTest {
    @Test
    fun `makes version 7 ids that carry their millisecond`() {
        val at = Instant.parse("2026-11-08T12:00:00.123Z")
        val ids = UuidV7Generator(Clock.fixed(at, ZoneOffset.UTC))
        val made = List(1000) { ids.next() }
        assertTrue(made.all { it.version() == 7 && it.variant() == 2 })
        assertTrue(made.all { it.mostSignificantBits ushr 16 == at.toEpochMilli() })
        assertEquals(made.size, made.toSet().size)
    }

    @Test
    fun `later ids sort after earlier ones`() {
        val first = UuidV7Generator(Clock.fixed(Instant.parse("2026-11-08T12:00:00Z"), ZoneOffset.UTC)).next()
        val second = UuidV7Generator(Clock.fixed(Instant.parse("2026-11-08T12:00:01Z"), ZoneOffset.UTC)).next()
        assertTrue(first.toString() < second.toString())
    }
}
