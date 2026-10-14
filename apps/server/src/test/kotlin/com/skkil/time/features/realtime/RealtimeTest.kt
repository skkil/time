package com.skkil.time.features.realtime

import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.support.ApiTest
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.post
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.UUID
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimeTest : ApiTest() {
    @LocalServerPort var port: Int = 0

    private fun ticket(): String = postJson("/api/v1/realtime/tickets")["ticket"].asString()

    private fun connect(ticket: String): Pair<WebSocketSession, LinkedBlockingQueue<String>> {
        val inbox = LinkedBlockingQueue<String>()
        val handler =
            object : TextWebSocketHandler() {
                override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
                    inbox.add(message.payload)
                }
            }
        val session =
            StandardWebSocketClient()
                .execute(handler, "ws://localhost:$port/api/v1/realtime?ticket=$ticket")
                .get(5, TimeUnit.SECONDS)
        return session to inbox
    }

    private fun writeAs(client: String) {
        mvc.post("/api/v1/projects") {
            with(jwt().jwt { it.subject(subject).issuer("https://issuer.test/") })
            header("X-Client-Id", client)
            contentType = MediaType.APPLICATION_JSON
            content = mapper.writeValueAsString(ProjectInput("Live", null, "blue"))
        }
    }

    @Test
    fun `announces a write to the user's open sockets`() {
        val (session, inbox) = connect(ticket())
        writeAs("tab-1")
        val event = mapper.readTree(inbox.poll(5, TimeUnit.SECONDS))
        assertEquals("changed", event["type"].asString())
        assertEquals("projects", event["topic"].asString())
        assertEquals("tab-1", event["writer"].asString())
        assertEquals(getJson("/api/v1/changes")["version"].asLong(), event["version"].asLong())
        session.close()
    }

    @Test
    fun `tickets work once`() {
        val ticket = ticket()
        connect(ticket).first.close()
        assertFailsWith<Exception> { connect(ticket) }
        assertFailsWith<Exception> { connect("not-a-ticket") }
    }

    @Test
    fun `keeps other users' changes to themselves`() {
        val (session, inbox) = connect(ticket())
        subject = UUID.randomUUID().toString()
        writeAs("someone-else")
        assertNull(inbox.poll(1, TimeUnit.SECONDS))
        session.close()
    }
}
