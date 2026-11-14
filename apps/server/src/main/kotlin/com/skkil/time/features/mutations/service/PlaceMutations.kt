package com.skkil.time.features.mutations.service

import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.places.service.PlaceService
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class PlaceMutations(
    private val places: PlaceService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("createPlace", "name") { caller, args ->
                places.create(caller, args.get<String>("name"))
            },
            mutation("renamePlace", "id", "name") { caller, args ->
                places.rename(caller.id, args.get<UUID>("id"), args.get<String>("name"))
            },
            mutation("deletePlace", "id") { caller, args ->
                places.delete(caller.id, args.get<UUID>("id"))
            },
            mutation("setTaskPlace", "id", "placeId") { caller, args ->
                places.setTaskPlace(caller.id, args.get<UUID>("id"), args.get<UUID?>("placeId"))
            },
        )
}
