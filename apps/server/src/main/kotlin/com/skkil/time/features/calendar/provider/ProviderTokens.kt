package com.skkil.time.features.calendar.provider

/**
 * Tokens from a code exchange or a refresh. [expiresAt] is in epoch seconds; a refresh may leave [refreshToken],
 * [subject] and [email] out, keeping the earlier ones.
 */
data class ProviderTokens(
    val accessToken: String,
    val refreshToken: String?,
    val expiresAt: Long,
    val subject: String? = null,
    val email: String? = null,
)
