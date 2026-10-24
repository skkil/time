package com.skkil.time.features.sync.service

import com.skkil.time.common.error.conflict
import com.skkil.time.common.web.Caller
import com.skkil.time.config.AppProperties
import com.skkil.time.features.sync.domain.SyncGrant
import com.skkil.time.features.sync.repository.ClientRepository
import org.skkil.store.token.SyncTokenIssuer
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Issues sync tokens to the caller's own clients; a client id first seen with another account is refused. */
@Service
class SyncTokenService(
    private val issuer: SyncTokenIssuer,
    private val clients: ClientRepository,
    private val properties: AppProperties,
) {
    @Transactional
    fun issue(caller: Caller, client: UUID, pushUrl: String): SyncGrant {
        if (clients.claim(client, caller.scopeId) != caller.scopeId) {
            conflict("This device id belongs to another account. Sign in again to get a new one.")
        }
        val token = issuer.issue(caller.scopeId, client)
        return SyncGrant(token.token, token.expiresAt.epochSecond, properties.sync.storeUrl, pushUrl)
    }

    fun jwks(): String = issuer.jwks()
}
