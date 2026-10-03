package com.skkil.time.auth

import com.skkil.time.common.Caller
import com.skkil.time.common.DomainException
import com.skkil.time.common.ErrorKind
import org.springframework.core.MethodParameter
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.context.request.RequestAttributes
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer
import java.time.ZoneId

/** Resolves a [Caller] controller parameter from the bearer token, creating the user on first sight. */
@Component
class CallerResolver(private val accounts: Accounts) : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter) = parameter.parameterType == Caller::class.java

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?,
    ): Caller {
        val jwt =
            SecurityContextHolder.getContext().authentication?.principal as? Jwt
                ?: throw DomainException(ErrorKind.UNAUTHORIZED, "Sign in again")
        val identity =
            Identity(
                issuer = jwt.issuer?.toString() ?: jwt.getClaimAsString("iss") ?: "",
                subject = jwt.subject ?: throw DomainException(ErrorKind.UNAUTHORIZED, "Sign in again"),
                email = jwt.getClaimAsString("email"),
                name = jwt.getClaimAsString("name"),
            )
        val account = accounts.find(identity) ?: accounts.provision(identity)
        webRequest.setAttribute(CALLER_ID_ATTRIBUTE, account.id, RequestAttributes.SCOPE_REQUEST)
        val requested =
            webRequest.getHeader(TIME_ZONE_HEADER)?.let { runCatching { ZoneId.of(it) }.getOrNull() }
        if (requested != null && requested != account.zone) accounts.saveZone(account.id, requested)
        return Caller(account.id, requested ?: account.zone)
    }
}

const val CALLER_ID_ATTRIBUTE = "com.skkil.time.callerId"
