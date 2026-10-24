package com.skkil.time.common.id

import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.UUID

/**
 * RFC 9562 version 5 (name-based, SHA-1) UUIDs. Rows the app seeds on its own take `of(scopeId, "<table>/<key>")`,
 * such as `ritual/morning`, so the server and an offline device seed the same ids.
 */
object UuidV5 {
    fun of(namespace: UUID, name: String): UUID {
        val digest =
            MessageDigest
                .getInstance("SHA-1")
                .apply {
                    update(
                        ByteBuffer
                            .allocate(16)
                            .putLong(namespace.mostSignificantBits)
                            .putLong(namespace.leastSignificantBits)
                            .array(),
                    )
                    update(name.toByteArray(Charsets.UTF_8))
                }.digest()
        digest[6] = ((digest[6].toInt() and 0x0f) or 0x50).toByte()
        digest[8] = ((digest[8].toInt() and 0x3f) or 0x80).toByte()
        val bytes = ByteBuffer.wrap(digest, 0, 16)
        return UUID(bytes.long, bytes.long)
    }
}
