package com.skkil.time.features.realtime

import org.postgresql.PGConnection
import org.slf4j.LoggerFactory
import org.springframework.context.SmartLifecycle
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import tools.jackson.databind.json.JsonMapper
import javax.sql.DataSource

/**
 * Fans change events out to every instance through Postgres LISTEN/NOTIFY, so a write on one instance reaches
 * websockets held by another. Delivery is best effort: clients also refetch when they reconnect.
 */
@Component
class RealtimeBus(
    private val jdbc: JdbcClient,
    private val dataSource: DataSource,
    private val hub: RealtimeHub,
    private val mapper: JsonMapper,
) : SmartLifecycle {
    private data class Envelope(val user: Long, val event: ChangeEvent)

    private val log = LoggerFactory.getLogger(javaClass)

    @Volatile private var running = false
    private var listener: Thread? = null

    fun publish(user: Long, event: ChangeEvent) {
        jdbc
            .sql("SELECT pg_notify(:channel, :payload)")
            .param("channel", CHANNEL)
            .param("payload", mapper.writeValueAsString(Envelope(user, event)))
            .query { _, _ -> }
            .list()
    }

    override fun start() {
        running = true
        listener = Thread.ofVirtual().name("realtime-listener").start(::listen)
    }

    override fun stop() {
        running = false
        listener?.interrupt()
    }

    override fun isRunning() = running

    private fun listen() {
        while (running) {
            runCatching {
                dataSource.connection.use { connection ->
                    connection.createStatement().use { it.execute("LISTEN $CHANNEL") }
                    val pg = connection.unwrap(PGConnection::class.java)
                    while (running) {
                        pg.getNotifications(POLL_MS)?.forEach { notification ->
                            val envelope = mapper.readValue(notification.parameter, Envelope::class.java)
                            hub.deliver(envelope.user, mapper.writeValueAsString(envelope.event))
                        }
                    }
                }
            }.onFailure {
                if (running) {
                    log.warn("Realtime listener lost its connection; retrying", it)
                    runCatching { Thread.sleep(RETRY_MS) }
                }
            }
        }
    }

    private companion object {
        const val CHANNEL = "realtime"
        const val POLL_MS = 10_000
        const val RETRY_MS = 2_000L
    }
}
