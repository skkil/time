package com.skkil.time.features.sync.service

import com.skkil.time.common.error.conflict
import com.skkil.time.common.web.Caller
import com.skkil.time.config.AppProperties
import com.skkil.time.features.sync.domain.SyncGrant
import org.skkil.store.token.SyncTokenIssuer
import org.skkil.store.writepath.StoreWritePath
import org.springframework.stereotype.Service
import java.util.UUID

/** Issues sync tokens to the caller's own clients; a client id first seen with another account is refused. */
@Service
class SyncTokenService(
    private val issuer: SyncTokenIssuer,
    private val writePath: StoreWritePath,
    private val properties: AppProperties,
) {
    fun issue(caller: Caller, client: UUID, pushUrl: String): SyncGrant {
        if (!writePath.claimClient(caller.scopeId, client)) {
            conflict("This device id belongs to another account. Sign in again to get a new one.")
        }
        val token = issuer.issue(caller.scopeId, client)
        return SyncGrant(token.token, token.expiresAt.epochSecond, properties.sync.storeUrl, pushUrl)
    }

    fun jwks(): String = issuer.jwks()
}
