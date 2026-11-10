package com.skkil.time.features.calendar.domain

import java.util.UUID

/** A calendar the sync reads, with where its last read left off. */
data class SyncedSource(val id: UUID, val externalId: String, val syncToken: String?, val fullSyncedAt: Long?)
