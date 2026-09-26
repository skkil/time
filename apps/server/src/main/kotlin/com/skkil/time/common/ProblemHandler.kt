package com.skkil.time.common

import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatusCode
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

@RestControllerAdvice
class ProblemHandler : ResponseEntityExceptionHandler() {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(DomainException::class)
    fun domain(error: DomainException): ProblemDetail = problem(error.kind, error.message ?: error.kind.code)

    @ExceptionHandler(DataIntegrityViolationException::class)
    fun integrity(error: DataIntegrityViolationException): ProblemDetail {
        log.warn("Integrity violation", error)
        return problem(ErrorKind.CONFLICT, "The change conflicts with existing data")
    }

    @ExceptionHandler(Exception::class)
    fun unexpected(error: Exception): ProblemDetail {
        log.error("Unhandled error", error)
        return problem(ErrorKind.DATABASE, "Something went wrong")
    }

    override fun handleExceptionInternal(
        ex: Exception,
        body: Any?,
        headers: HttpHeaders,
        statusCode: HttpStatusCode,
        request: WebRequest,
    ): ResponseEntity<Any>? {
        val detail = (body as? ProblemDetail) ?: ProblemDetail.forStatus(statusCode)
        detail.setProperty("kind", if (statusCode.is4xxClientError) ErrorKind.INVALID.code else ErrorKind.DATABASE.code)
        return super.handleExceptionInternal(ex, detail, headers, statusCode, request)
    }

    companion object {
        fun problem(kind: ErrorKind, message: String): ProblemDetail =
            ProblemDetail.forStatusAndDetail(kind.status, message).apply { setProperty("kind", kind.code) }
    }
}
