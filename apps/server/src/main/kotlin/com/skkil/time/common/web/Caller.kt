package com.skkil.time.common.web

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.clock.SystemMutationClock
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.id.UuidV7Generator
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID

/**
 * The signed-in user a request acts for, with the time zone that decides "today", the [clock] every write reads
 * "now" from and the [ids] that name the rows it creates.
 */
data class Caller(
    val id: Long,
    val zone: ZoneId,
    val clock: MutationClock = SystemMutationClock,
    val ids: IdGenerator = UuidV7Generator(),
) {
    fun now(): Long = clock.now().epochSecond

    fun today(): LocalDate = LocalDate.ofInstant(clock.now(), zone)

    fun localNow(): LocalDateTime = LocalDateTime.ofInstant(clock.now(), zone)

    fun nextId(): UUID = ids.next()

    /** The same caller acting at [clock] and naming new rows from [ids], as when a mutation is replayed. */
    fun acting(clock: MutationClock, ids: IdGenerator): Caller = copy(clock = clock, ids = ids)

    fun startOf(date: LocalDate): Long = date.atStartOfDay(zone).toEpochSecond()

    fun dateOf(seconds: Long): LocalDate = Instant.ofEpochSecond(seconds).atZone(zone).toLocalDate()

    fun at(date: LocalDate, minutes: Int): Long =
        date.atStartOfDay().plusMinutes(minutes.toLong()).atZone(zone).toEpochSecond()
}
