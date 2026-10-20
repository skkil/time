package com.skkil.time.common.clock

import java.time.Instant

/** Where a write reads "now": the system clock for a request, the moment the user acted for a replayed mutation. */
fun interface MutationClock {
    fun now(): Instant

    companion object {
        fun fixed(at: Instant): MutationClock = FixedMutationClock(at)

        fun fromHlc(hlc: Long): MutationClock = fixed(Hlc.instant(hlc))
    }
}
