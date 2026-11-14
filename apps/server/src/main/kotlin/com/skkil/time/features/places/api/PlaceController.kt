package com.skkil.time.features.places.api

import com.skkil.time.common.web.Caller
import com.skkil.time.features.places.domain.Place
import com.skkil.time.features.places.service.PlaceService
import com.skkil.time.features.tasks.domain.Task
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1")
class PlaceController(private val places: PlaceService) {
    @GetMapping("/places")
    fun list(caller: Caller): List<Place> = places.list(caller.id)

    @PostMapping("/places")
    fun create(
        caller: Caller,
        @RequestBody body: PlaceName,
    ): Place = places.create(caller, body.name)

    @PutMapping("/places/{id}")
    fun rename(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: PlaceName,
    ): Place = places.rename(caller.id, id, body.name)

    @DeleteMapping("/places/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        caller: Caller,
        @PathVariable id: UUID,
    ) = places.delete(caller.id, id)

    @PutMapping("/tasks/{id}/place")
    fun setTaskPlace(
        caller: Caller,
        @PathVariable id: UUID,
        @RequestBody body: TaskPlace,
    ): Task = places.setTaskPlace(caller.id, id, body.placeId)
}
