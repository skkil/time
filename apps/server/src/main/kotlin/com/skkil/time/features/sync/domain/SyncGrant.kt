package com.skkil.time.features.sync.domain

/**
 * What a device needs to sync: a store [token] for Pull and Pokes that expires at [expiresAt] (Unix seconds), the
 * store service's base URL and this server's base URL for Push.
 */
data class SyncGrant(val token: String, val expiresAt: Long, val storeUrl: String, val pushUrl: String)
