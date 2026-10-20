package com.skkil.time.common.id

import java.security.SecureRandom
import java.time.Clock
import java.util.UUID

/** Random RFC 9562 version 7 UUIDs: a millisecond timestamp, then 74 random bits. */
class UuidV7Generator(
    private val clock: Clock = Clock.systemUTC(),
    private val random: SecureRandom = SecureRandom(),
) : IdGenerator {
    override fun next(): UUID {
        val millis = clock.millis() and TIMESTAMP_MASK
        val high = (millis shl 16) or VERSION or random.nextInt(1 shl 12).toLong()
        val low = (random.nextLong() and RANDOM_B_MASK) or VARIANT
        return UUID(high, low)
    }

    private companion object {
        const val TIMESTAMP_MASK = (1L shl 48) - 1
        const val VERSION = 0x7000L
        const val RANDOM_B_MASK = 0x3FFF_FFFF_FFFF_FFFFL
        const val VARIANT = Long.MIN_VALUE
    }
}
