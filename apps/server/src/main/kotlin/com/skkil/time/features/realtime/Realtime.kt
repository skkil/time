package com.skkil.time.features.realtime

/** What every connected client of a user hears after a write: enough to refetch, never the data itself. */
data class ChangeEvent(val type: String, val version: Long, val writer: String?, val topic: String)

data class Ticket(val ticket: String, val expiresIn: Long)
