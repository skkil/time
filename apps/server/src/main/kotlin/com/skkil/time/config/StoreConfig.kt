package com.skkil.time.config

import com.skkil.time.common.error.DomainException
import com.skkil.time.features.mutations.domain.MutationDispatcher
import com.skkil.time.features.sync.service.DispatchedMutation
import org.skkil.store.push.MutationRegistry
import org.skkil.store.push.MutationRejectedException
import org.skkil.store.push.RejectionPolicy
import org.skkil.store.token.SyncTokenIssuer
import org.skkil.store.token.SyncTokenKeys
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey

/**
 * time as a store product: every contract mutation is pushable, a [DomainException] rejects a mutation (anything else
 * aborts the batch so the device retries), and sync tokens are signed with the configured key, or a key made at
 * startup in the `dev` profile.
 */
@Configuration
class StoreConfig {
    @Bean
    fun storeMutationRegistry(dispatcher: MutationDispatcher, handler: DispatchedMutation): MutationRegistry =
        MutationRegistry().apply { dispatcher.names.sorted().forEach { register(it, handler) } }

    @Bean
    fun rejectionPolicy(): RejectionPolicy =
        RejectionPolicy.of(
            DomainException::class,
            MutationRejectedException::class,
        )

    @Bean
    fun syncTokenIssuer(properties: AppProperties, environment: Environment): SyncTokenIssuer {
        val sync = properties.sync
        if (sync.tokenPrivateKeyPem.isNotBlank() || sync.tokenPublicKeyPem.isNotBlank()) {
            return SyncTokenIssuer.fromPem(ISSUER, sync.tokenPrivateKeyPem, sync.tokenPublicKeyPem)
        }
        check(environment.matchesProfiles(DEV)) {
            "Set STORE_TOKEN_PRIVATE_KEY_PEM and STORE_TOKEN_PUBLIC_KEY_PEM; only the dev profile makes its own key"
        }
        val pair = SyncTokenKeys.generate()
        return SyncTokenIssuer(ISSUER, pair.private as ECPrivateKey, pair.public as ECPublicKey)
    }

    private companion object {
        const val ISSUER = "time"
        const val DEV = "dev"
    }
}
