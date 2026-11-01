package com.skkil.time.features.account.api

import java.util.UUID

/** The signed-in account: its id, the time zone its clients last sent and its store scope, which sync binds to. */
data class Me(val id: Long, val timeZone: String, val scopeId: UUID)
