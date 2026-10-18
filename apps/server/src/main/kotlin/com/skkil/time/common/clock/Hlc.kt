package com.skkil.time.common.clock

import java.time.Instant

/** A hybrid logical clock reading: `(unix_millis << 16) | counter`. */
object Hlc {
    private const val COUNTER_BITS = 16
    private const val COUNTER_MASK = (1L shl COUNTER_BITS) - 1

    fun of(millis: Long, counter: Int): Long = (millis shl COUNTER_BITS) or (counter.toLong() and COUNTER_MASK)

    fun millis(hlc: Long): Long = hlc ushr COUNTER_BITS

    fun counter(hlc: Long): Int = (hlc and COUNTER_MASK).toInt()

    fun instant(hlc: Long): Instant = Instant.ofEpochMilli(millis(hlc))
}
