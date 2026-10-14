package com.skkil.time.features.rituals.domain

import com.skkil.time.common.web.Caller
import java.time.Instant
import java.time.LocalDate

/** A point in the caller's day: the local date, minutes since local midnight and the epoch second. */
data class Moment(val date: LocalDate, val minute: Int, val stamp: Long) {
    companion object {
        fun now(caller: Caller): Moment {
            val stamp = caller.now()
            val local = Instant.ofEpochSecond(stamp).atZone(caller.zone)
            return Moment(local.toLocalDate(), local.hour * 60 + local.minute, stamp)
        }
    }
}
