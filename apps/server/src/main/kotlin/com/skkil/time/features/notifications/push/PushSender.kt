package com.skkil.time.features.notifications.push

import com.skkil.time.features.notifications.domain.PushMessage

/** Delivers pushes for one device [kind]; returns the ids of devices the push service says are gone. */
interface PushSender {
    val kind: String

    fun send(messages: List<PushMessage>): Set<Long>
}
