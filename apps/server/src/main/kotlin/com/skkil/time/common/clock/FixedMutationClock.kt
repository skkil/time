package com.skkil.time.common.clock

import java.time.Instant

data class FixedMutationClock(val at: Instant) : MutationClock {
    override fun now(): Instant = at
}
