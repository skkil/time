package com.skkil.time.common.clock

import com.skkil.time.common.web.Caller
import org.junit.jupiter.api.Test
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID
import kotlin.test.assertEquals

class MutationClockTest {
    @Test
    fun `reads the moment out of a hybrid logical clock`() {
        val acted = Instant.parse("2026-11-08T14:30:15.250Z")
        val hlc = Hlc.of(acted.toEpochMilli(), 7)
        assertEquals(acted.toEpochMilli(), Hlc.millis(hlc))
        assertEquals(7, Hlc.counter(hlc))
        assertEquals(acted, MutationClock.fromHlc(hlc).now())
        assertEquals((acted.toEpochMilli() shl 16) or 7, hlc)
    }

    @Test
    fun `a caller's now and today follow its clock in its own zone`() {
        val acted = Instant.parse("2026-11-08T23:30:00Z")
        val caller =
            Caller(1, UUID.randomUUID(), ZoneId.of("Asia/Seoul")).acting(MutationClock.fixed(acted), {
                error("unused")
            })
        assertEquals(acted.epochSecond, caller.now())
        assertEquals(LocalDate.parse("2026-11-09"), caller.today())
        assertEquals(LocalDate.parse("2026-11-08"), caller.copy(zone = ZoneId.of("UTC")).today())
    }

    @Test
    fun `no write path reads the system clock directly`() {
        val sources = File("src/main/kotlin")
        val direct =
            Regex(
                """\b(Instant|LocalDate|LocalDateTime|LocalTime|ZonedDateTime|OffsetDateTime)\.now\(|System\.currentTimeMillis\(""",
            )
        val offenders =
            sources
                .walkTopDown()
                .filter { it.isFile && it.extension == "kt" && it.name != "SystemMutationClock.kt" }
                .filter { direct.containsMatchIn(it.readText()) }
                .map { it.relativeTo(sources).path }
                .toList()
        assertEquals(emptyList(), offenders, "Read now from Caller or an injected MutationClock")
    }
}
