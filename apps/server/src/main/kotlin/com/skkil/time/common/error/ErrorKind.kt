package com.skkil.time.common.error

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
