package com.skkil.time.features.calendar.domain

/** A consent in progress: who started it and the PKCE verifier that finishes it. */
data class PendingConnect(val user: Long, val verifier: String)
