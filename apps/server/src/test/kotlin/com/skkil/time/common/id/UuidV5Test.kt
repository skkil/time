package com.skkil.time.common.id

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals

class UuidV5Test {
    @Test
    fun `matches RFC 9562 name-based ids`() {
        val dns = UUID.fromString("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
        assertEquals(UUID.fromString("886313e1-3b8a-5372-9b90-0c9aee199e5d"), UuidV5.of(dns, "python.org"))
    }

    @Test
    fun `seeded ritual ids are the scope and kind`() {
        val scope = UUID.fromString("01923e4c-8b1a-7c3d-9e2f-0a1b2c3d4e5f")
        assertEquals(UUID.fromString("48db33ea-6df6-5c55-8ae9-b8639e049709"), UuidV5.of(scope, "ritual/morning"))
    }
}
