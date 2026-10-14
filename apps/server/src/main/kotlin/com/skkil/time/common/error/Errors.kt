package com.skkil.time.common.error

fun invalid(message: String): Nothing = throw DomainException(ErrorKind.INVALID, message)

fun notFound(message: String): Nothing = throw DomainException(ErrorKind.NOT_FOUND, message)

fun conflict(message: String): Nothing = throw DomainException(ErrorKind.CONFLICT, message)

inline fun ensure(condition: Boolean, message: () -> String) {
    if (!condition) invalid(message())
}

fun <T : Any> T?.orNotFound(what: String): T = this ?: notFound("$what not found.")

fun ensureChanged(rows: Int, what: String) {
    if (rows == 0) notFound("$what not found.")
}
