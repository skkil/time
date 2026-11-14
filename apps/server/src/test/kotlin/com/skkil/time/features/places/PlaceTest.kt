package com.skkil.time.features.places

import com.skkil.time.features.places.api.PlaceName
import com.skkil.time.features.places.api.TaskPlace
import com.skkil.time.support.TaskApiTest
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PlaceTest : TaskApiTest() {
    @Test
    fun `place names are unique per user, ignoring case`() {
        val home = postJson("/api/v1/places", PlaceName("Home")).id()
        val office = postJson("/api/v1/places", PlaceName("Office")).id()
        expectProblem(post("/api/v1/places", PlaceName("home")), 422, "invalid")
        expectProblem(post("/api/v1/places", PlaceName(" ")), 422, "invalid")
        expectProblem(post("/api/v1/places", PlaceName("x".repeat(81))), 422, "invalid")
        expectProblem(put("/api/v1/places/$office", PlaceName("HOME")), 422, "invalid")
        assertEquals("home", putJson("/api/v1/places/$home", PlaceName("home"))["name"].asString())
        assertEquals(listOf("home", "Office"), getJson("/api/v1/places").toList().map { it["name"].asString() })
        subject = UUID.randomUUID().toString()
        postJson("/api/v1/places", PlaceName("Home"))
    }

    @Test
    fun `a task takes one place and deleting the place clears it`() {
        val library = postJson("/api/v1/places", PlaceName("Library")).id()
        val task = create(input("Read")).id()
        assertTrue(task(task)["placeId"].isNull)
        assertEquals(library, putJson("/api/v1/tasks/$task/place", TaskPlace(library)).uuid("placeId"))
        expectProblem(put("/api/v1/tasks/$task/place", TaskPlace(UUID.randomUUID())), 404, "notFound")
        delete("/api/v1/places/$library").andExpect { status { isNoContent() } }
        assertTrue(task(task)["placeId"].isNull)
        expectProblem(delete("/api/v1/places/$library"), 404, "notFound")
    }

    @Test
    fun `keeps each user's places and tasks apart`() {
        val mine = postJson("/api/v1/places", PlaceName("Mine")).id()
        val task = create(input("Mine")).id()
        subject = UUID.randomUUID().toString()
        assertEquals(0, getJson("/api/v1/places").size())
        expectProblem(put("/api/v1/places/$mine", PlaceName("Theirs")), 404, "notFound")
        expectProblem(put("/api/v1/tasks/$task/place", TaskPlace(null)), 404, "notFound")
        val theirs = postJson("/api/v1/places", PlaceName("Theirs")).id()
        val own = create(input("Theirs")).id()
        expectProblem(put("/api/v1/tasks/$own/place", TaskPlace(mine)), 404, "notFound")
        assertEquals(theirs, putJson("/api/v1/tasks/$own/place", TaskPlace(theirs)).uuid("placeId"))
    }
}
