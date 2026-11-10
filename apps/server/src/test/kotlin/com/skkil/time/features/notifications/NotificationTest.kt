package com.skkil.time.features.notifications

import com.skkil.time.features.notifications.domain.DeviceInput
import com.skkil.time.features.notifications.domain.EXPO
import com.skkil.time.features.notifications.domain.Push
import com.skkil.time.features.notifications.domain.PushMessage
import com.skkil.time.features.notifications.domain.WEB
import com.skkil.time.features.notifications.job.REMINDER_LOCK_KEY
import com.skkil.time.features.notifications.job.ReminderJob
import com.skkil.time.features.notifications.push.ExpoPushSender
import com.skkil.time.features.notifications.push.PushSender
import com.skkil.time.features.notifications.push.WebPushSender
import com.skkil.time.features.settings.api.Enabled
import com.skkil.time.features.time.domain.BlockSpan
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID
import javax.sql.DataSource
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class NotificationTest : TaskApiTest() {
    @MockitoBean lateinit var expo: ExpoPushSender

    @MockitoBean lateinit var web: WebPushSender

    @Autowired lateinit var job: ReminderJob

    @Autowired lateinit var dataSource: DataSource

    @BeforeEach
    fun kinds() {
        Mockito.`when`(expo.kind).thenReturn(EXPO)
        Mockito.`when`(web.kind).thenReturn(WEB)
    }

    private fun register(token: String = "ExponentPushToken[${UUID.randomUUID()}]") =
        postJson("/api/v1/notifications/devices", DeviceInput(EXPO, token, label = "Phone"))["id"].asLong()

    private fun timed(title: String, at: LocalDateTime) =
        create(input(title).copy(dueDate = at.toLocalDate(), dueTime = at.hour * 60 + at.minute)).id()

    private fun localNow(now: Instant) = LocalDateTime.ofInstant(now, ZoneId.of(zone))

    @Suppress("UNCHECKED_CAST")
    private fun sent(sender: PushSender): List<PushMessage> =
        Mockito
            .mockingDetails(sender)
            .invocations
            .filter { it.method.name == "send" }
            .flatMap { it.arguments[0] as List<PushMessage> }

    private fun pushedTasks(sender: PushSender = expo) = sent(sender).map { it.push.taskId }

    @Test
    fun `fires once at the due time to every device`() {
        val now = Instant.now()
        val phone = register()
        val tablet = register()
        val id = timed("Call dentist", localNow(now))
        val later = timed("Later", localNow(now).plusMinutes(5))

        job.run(now)
        job.run(now.plusSeconds(20))

        val pushes = sent(expo).filter { it.push.taskId == id }
        assertEquals(setOf(phone, tablet), pushes.map { it.target.id }.toSet())
        assertEquals(2, pushes.size)
        val minute = localNow(now)
        assertEquals(Push("Call dentist", "%02d:%02d".format(minute.hour, minute.minute), id), pushes[0].push)
        assertTrue(later !in pushedTasks())
    }

    @Test
    fun `fires again after a reschedule`() {
        val now = Instant.now()
        register()
        val id = timed("Call", localNow(now).minusMinutes(5))
        job.run(now)
        put("/api/v1/tasks/$id", input("Call").copy(dueDate = localNow(now).toLocalDate(), dueTime = minuteOf(now)))
        job.run(now)
        assertEquals(2, pushedTasks().count { it == id })
    }

    private fun minuteOf(now: Instant) = localNow(now).let { it.hour * 60 + it.minute }

    @Test
    fun `skips old, finished and turned off`() {
        val now = Instant.now()
        register()
        val old = timed("Long gone", localNow(now).minusMinutes(11))
        val done = timed("Done", localNow(now))
        complete(done)
        job.run(now)
        assertTrue(pushedTasks().none { it == old || it == done })

        subject = UUID.randomUUID().toString()
        register()
        put("/api/v1/settings/reminders", Enabled(false))
        val off = timed("Muted", localNow(now))
        job.run(now)
        assertTrue(off !in pushedTasks())
    }

    @Test
    fun `uses the owner's time zone`() {
        val now = Instant.now()
        zone = "Pacific/Kiritimati"
        register()
        val local = timed("Local", localNow(now))
        val utcClock = timed("UTC clock", LocalDateTime.ofInstant(now, ZoneId.of("UTC")))
        job.run(now)
        assertTrue(local in pushedTasks())
        assertTrue(utcClock !in pushedTasks())
    }

    @Test
    fun `lists upcoming reminders by kind, as time-core does`() {
        val now = Instant.now().epochSecond / 60 * 60
        val local = localNow(Instant.ofEpochSecond(now)).plusMinutes(30)
        val call = timed("Call", local)
        val write = create(input("Write")).id()
        postJson("/api/v1/tasks/$write/blocks", BlockSpan(now + 600, now + 4200))
        val window = "/api/v1/notifications/reminders?from=$now&to=${now + 3600}"

        val all = getJson(window)
        assertEquals(listOf("block", "task"), all.values().map { it["kind"].asString() })
        assertEquals(call.toString(), all.values().last()["taskId"].asString())
        assertEquals(1, getJson("$window&blocks=false").size())
        assertEquals(0, getJson("$window&on=false").size())

        put("/api/v1/settings/reminders", Enabled(false))
        assertEquals(0, getJson(window).size())
    }

    @Test
    fun `leaves phones that schedule their own reminders alone`() {
        val now = Instant.now()
        val phone =
            postJson(
                "/api/v1/notifications/devices",
                DeviceInput(EXPO, "ExponentPushToken[local]", label = "Phone", scheduling = "local"),
            )["id"].asLong()
        val id = timed("Call", localNow(now))
        job.run(now)
        assertTrue(sent(expo).none { it.target.id == phone })
        assertTrue(id !in pushedTasks())

        val tablet = register()
        job.run(now)
        assertEquals(listOf(tablet), sent(expo).filter { it.push.taskId == id }.map { it.target.id })
    }

    @Test
    fun `only phones schedule reminders themselves`() {
        post("/api/v1/notifications/devices", DeviceInput(WEB, "https://push", "k", "a", scheduling = "local"))
            .andExpect { status { isEqualTo(422) } }
    }

    @Test
    fun `forgets devices the push service dropped`() {
        val now = Instant.now()
        val gone = register()
        val kept = register()
        Mockito.`when`(expo.send(Mockito.anyList())).thenReturn(setOf(gone))
        timed("Ping", localNow(now))
        job.run(now)
        assertEquals(listOf(kept), getJson("/api/v1/notifications/devices").values().map { it["id"].asLong() })
    }

    @Test
    fun `a second instance sends nothing while one holds the lock`() {
        val now = Instant.now()
        register()
        val id = timed("Once", localNow(now))
        dataSource.connection.use { other ->
            other.autoCommit = false
            other.createStatement().use { it.execute("SELECT pg_advisory_xact_lock($REMINDER_LOCK_KEY)") }
            assertNull(job.run(now))
            other.rollback()
        }
        assertTrue(id !in pushedTasks())
        job.run(now)
        assertTrue(id in pushedTasks())
    }

    @Test
    fun `web devices need their subscription keys`() {
        expectProblem(
            post("/api/v1/notifications/devices", DeviceInput(WEB, "https://push.example/abc")),
            422,
            "invalid",
        )
        val id =
            postJson(
                "/api/v1/notifications/devices",
                DeviceInput(WEB, "https://push.example/abc", "key", "secret", "Firefox"),
            )["id"].asLong()
        val devices = getJson("/api/v1/notifications/devices")
        assertEquals(listOf(id), devices.values().map { it["id"].asLong() })
        assertEquals("web", devices[0]["kind"].asString())
        assertTrue(getJson("/api/v1/notifications/config")["webPushPublicKey"].isNull)
    }

    @Test
    fun `devices are per user and move with their token`() {
        val token = "ExponentPushToken[shared-${UUID.randomUUID()}]"
        val mine = register(token)
        val owner = subject

        subject = UUID.randomUUID().toString()
        assertEquals(0, getJson("/api/v1/notifications/devices").size())
        expectProblem(delete("/api/v1/notifications/devices/$mine"), 404, "notFound")
        assertEquals(mine, register(token))
        assertEquals(1, getJson("/api/v1/notifications/devices").size())

        subject = owner
        assertEquals(0, getJson("/api/v1/notifications/devices").size())

        subject = UUID.randomUUID().toString()
        val other = register()
        delete("/api/v1/notifications/devices/$other").andExpect { status { isNoContent() } }
        assertEquals(0, getJson("/api/v1/notifications/devices").size())
    }
}
