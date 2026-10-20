package com.skkil.time.features.mutations.domain

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.web.Caller
import tools.jackson.databind.JsonNode

/**
 * Runs one write command by its contract name (`createTask`, `moveTask`, ...) with [args] keyed by the contract's
 * parameter names. Every "now" it reads comes from [clock] and every row it creates takes its id from [idSource], so a
 * replayed mutation lands as it did on the device. Rule failures throw `DomainException`.
 */
interface MutationDispatcher {
    val names: Set<String>

    fun dispatch(caller: Caller, name: String, args: JsonNode, clock: MutationClock, idSource: IdGenerator): Any?
}
