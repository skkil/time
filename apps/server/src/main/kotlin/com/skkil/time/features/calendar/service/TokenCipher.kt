package com.skkil.time.features.calendar.service

import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Encrypts provider tokens at rest with AES-256-GCM: a random nonce per token, stored with it as base64. */
class TokenCipher(key: ByteArray) {
    private val key = SecretKeySpec(key.also { require(it.size == KEY_BYTES) { "The key must be 32 bytes" } }, "AES")
    private val random = SecureRandom()

    fun encrypt(plain: String): String {
        val nonce = ByteArray(NONCE_BYTES).also(random::nextBytes)
        val cipher =
            Cipher.getInstance(TRANSFORMATION).apply {
                init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_BITS, nonce))
            }
        return Base64.getEncoder().encodeToString(nonce + cipher.doFinal(plain.toByteArray()))
    }

    fun decrypt(sealed: String): String {
        val bytes = Base64.getDecoder().decode(sealed)
        val cipher =
            Cipher.getInstance(TRANSFORMATION).apply {
                init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, bytes, 0, NONCE_BYTES))
            }
        return String(cipher.doFinal(bytes, NONCE_BYTES, bytes.size - NONCE_BYTES))
    }

    companion object {
        const val KEY_BYTES = 32
        private const val NONCE_BYTES = 12
        private const val TAG_BITS = 128
        private const val TRANSFORMATION = "AES/GCM/NoPadding"

        fun fromBase64(key: String): TokenCipher = TokenCipher(Base64.getDecoder().decode(key.trim()))

        fun random(): TokenCipher = TokenCipher(ByteArray(KEY_BYTES).also(SecureRandom()::nextBytes))
    }
}
