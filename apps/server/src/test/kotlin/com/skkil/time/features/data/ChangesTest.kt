package com.skkil.time.features.data

import com.skkil.time.features.projects.ProjectInput
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.post
import java.util.UUID
import kotlin.test.assertEquals

class ChangesTest : ApiTest() {
    private fun changes() = getJson("/api/v1/changes")

    private fun write(name: String, client: String) =
        mvc.post("/api/v1/projects") {
            with(jwt().jwt { it.subject(subject).issuer("https://issuer.test/") })
            header("X-Client-Id", client)
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(ProjectInput(name, null, "blue"))
        }

    @Test
    fun `counts successful writes and remembers who wrote last`() {
        val start = changes()["version"].asLong()
        getJson("/api/v1/projects")
        assertEquals(start, changes()["version"].asLong())

        write("Home", "tab-a").andExpect { status { isOk() } }
        assertEquals(start + 1, changes()["version"].asLong())
        assertEquals("tab-a", changes()["lastWriter"].asString())

        write("  ", "tab-b").andExpect { status { isEqualTo(422) } }
        assertEquals(start + 1, changes()["version"].asLong())

        post("/api/v1/projects", ProjectInput("Work", null, "blue"))
        val after = changes()
        assertEquals(start + 2, after["version"].asLong())
        assertEquals(true, after["lastWriter"].isNull)
    }

    @Test
    fun `each user has their own version`() {
        write("Home", "tab-a")
        val owner = subject
        subject = UUID.randomUUID().toString()
        assertEquals(0, changes()["version"].asLong())
        post("/api/v1/projects", ProjectInput("Work", null, "blue"))
        post("/api/v1/projects", ProjectInput("Side", null, "blue"))
        assertEquals(2, changes()["version"].asLong())
        subject = owner
        assertEquals(1, changes()["version"].asLong())
    }
}
