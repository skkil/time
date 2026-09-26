package com.skkil.time.common

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/** The signed-in user a request acts for, with the time zone that decides "today". */
data class Caller(val id: Long, val zone: ZoneId) {
    fun now(): Long = Instant.now().epochSecond

    fun today(): LocalDate = LocalDate.now(zone)

    fun localNow(): LocalDateTime = LocalDateTime.now(zone)

    fun startOf(date: LocalDate): Long = date.atStartOfDay(zone).toEpochSecond()

    fun dateOf(seconds: Long): LocalDate = Instant.ofEpochSecond(seconds).atZone(zone).toLocalDate()

    fun at(date: LocalDate, minutes: Int): Long =
        date.atStartOfDay().plusMinutes(minutes.toLong()).atZone(zone).toEpochSecond()
}
