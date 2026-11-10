package com.skkil.time.features.calendar.provider

/**
 * A provider call that failed, by what the server does about it: [Reason.REVOKED] asks the person to connect again,
 * [Reason.RESYNC] reads the whole window again, and [Reason.RETRY] and [Reason.FAILED] try again later.
 */
class ProviderException(val reason: Reason, message: String, cause: Throwable? = null) :
    RuntimeException(message, cause) {
    enum class Reason { REVOKED, RESYNC, RETRY, FAILED }
}
