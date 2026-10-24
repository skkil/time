package com.skkil.time.features.sync.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.sync.domain.SyncGrant
import com.skkil.time.features.sync.service.SyncTokenService
import com.skkil.time.features.sync.web.OwnWritePath
import io.swagger.v3.oas.annotations.Hidden
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.support.ServletUriComponentsBuilder

@RestController
@RequestMapping("/api/v1/sync")
class SyncController(private val tokens: SyncTokenService) {
    /** A sync token for one of the caller's clients, with where to pull and push. */
    @OwnWritePath
    @PostMapping("/token")
    fun token(
        caller: Caller,
        @RequestBody request: SyncTokenRequest,
    ): SyncGrant =
        tokens.issue(caller, request.clientId, ServletUriComponentsBuilder.fromCurrentContextPath().toUriString())

    /** The public key sync tokens are signed with, for the store service's `STORE_TOKEN_JWKS_URL`. */
    @Hidden
    @GetMapping("/jwks.json", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun jwks(): String = tokens.jwks()
}
