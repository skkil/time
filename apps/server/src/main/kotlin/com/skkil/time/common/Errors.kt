package com.skkil.time.common

import org.springframework.http.HttpStatus

enum class ErrorKind(val status: HttpStatus) {
    INVALID(HttpStatus.UNPROCESSABLE_CONTENT),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    CONFLICT(HttpStatus.CONFLICT),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
    DATABASE(HttpStatus.INTERNAL_SERVER_ERROR),
    ;

    val code: String = name.lowercase().replace(Regex("_([a-z])")) { it.groupValues[1].uppercase() }
}

class DomainException(val kind: ErrorKind, message: String) : RuntimeException(message)

fun invalid(message: String): Nothing = throw DomainException(ErrorKind.INVALID, message)

fun notFound(message: String): Nothing = throw DomainException(ErrorKind.NOT_FOUND, message)

fun conflict(message: String): Nothing = throw DomainException(ErrorKind.CONFLICT, message)

inline fun ensure(condition: Boolean, message: () -> String) {
    if (!condition) invalid(message())
}

fun <T : Any> T?.orNotFound(what: String): T = this ?: notFound("$what not found.")
