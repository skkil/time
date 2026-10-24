package com.skkil.time.features.sync

import com.nimbusds.jose.crypto.ECDSAVerifier
import com.nimbusds.jose.jwk.ECKey
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jwt.SignedJWT
import com.skkil.time.features.sync.api.SyncTokenRequest
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.get
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SyncTokenTest : ApiTest() {
    private val client = UUID.randomUUID()

    private fun jwks(): JWKSet {
        val body = mvc.get("/api/v1/sync/jwks.json").andExpect { status { isOk() } }.andReturn().response
        return JWKSet.parse(body.contentAsString)
    }

    @Test
    fun `a token names the caller's scope and client and expires within 15 minutes`() {
        val grant = postJson("/api/v1/sync/token", SyncTokenRequest(client))
        val jwt = SignedJWT.parse(grant["token"].asString())
        val claims = jwt.jwtClaimsSet

        assertEquals("time", claims.issuer)
        assertEquals(listOf("skkil-store"), claims.audience)
        assertEquals(scopeId().toString(), claims.subject)
        assertEquals(client.toString(), claims.getStringClaim("cid"))
        val lifetime = claims.expirationTime.time - claims.issueTime.time
        assertTrue(lifetime in 1..15 * 60 * 1000, "lifetime $lifetime ms")
        assertEquals(claims.expirationTime.time / 1000, grant["expiresAt"].asLong())

        val key = jwks().getKeyByKeyId(jwt.header.keyID) as ECKey
        assertTrue(jwt.verify(ECDSAVerifier(key)))
        assertEquals("http://localhost:8091", grant["storeUrl"].asString())
        assertEquals("http://localhost", grant["pushUrl"].asString())
    }

    @Test
    fun `a client stays with the account that first used it`() {
        postJson("/api/v1/sync/token", SyncTokenRequest(client))
        postJson("/api/v1/sync/token", SyncTokenRequest(client))

        subject = UUID.randomUUID().toString()
        expectProblem(post("/api/v1/sync/token", SyncTokenRequest(client)), 409, "conflict")
        postJson("/api/v1/sync/token", SyncTokenRequest(UUID.randomUUID()))
    }

    @Test
    fun `the key set is public and the token endpoint is not`() {
        assertEquals(1, jwks().keys.size)
        mvc.get("/api/v1/sync/token").andExpect { status { isUnauthorized() } }
    }
}
