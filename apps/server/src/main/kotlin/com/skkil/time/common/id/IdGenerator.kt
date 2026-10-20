package com.skkil.time.common.id

import java.util.UUID

/** Makes the id of each row a write creates, in the order it creates them. */
fun interface IdGenerator {
    fun next(): UUID
}
