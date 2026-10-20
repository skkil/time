package com.skkil.time.common.clock

import java.time.Instant

object SystemMutationClock : MutationClock {
    override fun now(): Instant = Instant.now()
}
