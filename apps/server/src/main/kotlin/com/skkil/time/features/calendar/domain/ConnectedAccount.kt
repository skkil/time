package com.skkil.time.features.calendar.domain

import java.util.UUID

/** A connected account as the sync reads it, tokens still sealed. */
data class ConnectedAccount(
    val id: UUID,
    val user: Long,
    val scope: UUID,
    val refreshToken: String,
    val accessToken: String?,
    val expiresAt: Long,
    val failures: Int,
)
