package com.skkil.time.features.calendar.service

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.web.Caller
import com.skkil.time.features.calendar.domain.CalendarEvent
import com.skkil.time.features.calendar.domain.CalendarSource
import com.skkil.time.features.calendar.domain.CalendarStatus
import com.skkil.time.features.calendar.domain.ConnectLink
import com.skkil.time.features.calendar.provider.ProviderException
import com.skkil.time.features.calendar.repository.CalendarRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.LocalDate
import java.util.Base64
import java.util.UUID

/**
 * Connecting, reading and disconnecting calendars. Connecting is OAuth with PKCE run by the server: [connect] binds a
 * random state to the caller for [CONNECT_SECONDS], and [finish] trades the code for tokens, stores them sealed and
 * reads the calendars once. Disconnecting revokes the grant and removes the account with its calendars and events.
 */
@Service
class CalendarService(
    private val connector: CalendarConnector,
    private val repository: CalendarRepository,
    private val sync: CalendarSync,
    private val clock: MutationClock,
    private val ids: IdGenerator,
) {
    private val random = SecureRandom()

    fun status(caller: Caller): CalendarStatus = CalendarStatus(connector.available, repository.accounts(caller.id))

    fun connect(caller: Caller): ConnectLink {
        val provider = connector.provider
        val state = token()
        val verifier = token()
        repository.savePending(state, caller.id, verifier, caller.now() + CONNECT_SECONDS, caller.now())
        return ConnectLink(provider.authorizeUrl(state, challenge(verifier)))
    }

    /** Finishes a consent from the provider's redirect and returns the account it connected. */
    fun finish(state: String, code: String): UUID {
        val now = clock.now()
        val pending = repository.takePending(state, now.epochSecond) ?: invalid(EXPIRED)
        val tokens =
            try {
                connector.provider.exchange(code, pending.verifier)
            } catch (error: ProviderException) {
                log.warn("Calendar consent failed: {}", error.message)
                invalid(FAILED)
            }
        val cipher = connector.cipher
        val subject = tokens.subject ?: tokens.email ?: invalid(FAILED)
        val existing = repository.accountFor(pending.user, GOOGLE, subject)
        val id =
            if (existing != null) {
                repository.reconnect(
                    pending.user,
                    existing,
                    tokens.email,
                    tokens.refreshToken?.let(cipher::encrypt),
                    cipher.encrypt(tokens.accessToken),
                    tokens.expiresAt,
                )
                existing
            } else {
                val refresh = tokens.refreshToken ?: invalid(FAILED)
                ids.next().also {
                    repository.insertAccount(
                        it,
                        pending.user,
                        GOOGLE,
                        subject,
                        tokens.email,
                        cipher.encrypt(refresh),
                        cipher.encrypt(tokens.accessToken),
                        tokens.expiresAt,
                        now.epochSecond,
                    )
                }
            }
        sync.sync(pending.user, id, now)
        return id
    }

    fun disconnect(caller: Caller, id: UUID) {
        val account = repository.connected(caller.id, id).orNotFound("Calendar account")
        if (connector.available) {
            runCatching { connector.provider.revoke(connector.cipher.decrypt(account.refreshToken)) }
                .onFailure { log.warn("Revoking calendar account {} failed: {}", id, it.message) }
        }
        ensureChanged(repository.deleteAccount(caller.id, id), "Calendar account")
    }

    fun sources(caller: Caller): List<CalendarSource> = repository.sources(caller.id)

    fun events(caller: Caller, from: LocalDate, to: LocalDate): List<CalendarEvent> =
        repository.events(caller.id, caller.zone, from, to)

    fun setVisible(caller: Caller, id: UUID, visible: Boolean): CalendarSource {
        ensureChanged(repository.setVisible(caller.id, id, visible), "Calendar")
        return repository.source(caller.id, id).orNotFound("Calendar")
    }

    private fun token(): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(TOKEN_BYTES).also(random::nextBytes))

    private fun challenge(verifier: String): String =
        Base64
            .getUrlEncoder()
            .withoutPadding()
            .encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))

    companion object {
        const val GOOGLE = "google"
        const val CONNECT_SECONDS = 10 * 60L
        const val EXPIRED = "This link to connect your calendar has expired. Connect again from Settings."
        const val FAILED = "Google didn't let skkil time read your calendar. Try connecting again."
        private const val TOKEN_BYTES = 32
        private val log = LoggerFactory.getLogger(CalendarService::class.java)
    }
}
