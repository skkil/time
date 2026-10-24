package com.skkil.time.features.mutations.service

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.error.DomainException
import com.skkil.time.common.error.ErrorKind
import com.skkil.time.common.error.asIdConflict
import com.skkil.time.common.error.invalid
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.web.Caller
import com.skkil.time.features.mutations.domain.Mutation
import com.skkil.time.features.mutations.domain.MutationArgs
import com.skkil.time.features.mutations.domain.MutationDispatcher
import com.skkil.time.features.mutations.domain.MutationSet
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper

/**
 * Every write command by contract name, each run in one transaction (or the one already open) as the caller acting at
 * the mutation's clock. A constraint the rules did not catch is a `conflict`, so a replayed mutation is rejected rather
 * than retried forever.
 */
@Service
class MutationRegistry(
    sets: List<MutationSet>,
    private val mapper: JsonMapper,
    transactions: PlatformTransactionManager,
) : MutationDispatcher {
    private val transaction = TransactionTemplate(transactions)

    val mutations: Map<String, Mutation> =
        sets.flatMap { it.mutations }.groupBy { it.name }.mapValues { (name, found) ->
            check(found.size == 1) { "Mutation $name is registered ${found.size} times" }
            found.single()
        }

    override val names: Set<String> = mutations.keys

    override fun dispatch(
        caller: Caller,
        name: String,
        args: JsonNode,
        clock: MutationClock,
        idSource: IdGenerator,
    ): Any? {
        val mutation = mutations[name] ?: invalid("Unknown mutation: $name")
        if (!args.isObject) invalid("Mutation arguments must be a JSON object.")
        val acting = caller.acting(clock, idSource)
        return try {
            transaction.execute { mutation.apply(acting, MutationArgs(args, mapper)) }
        } catch (error: DataIntegrityViolationException) {
            throw error.asIdConflict() ?: DomainException(ErrorKind.CONFLICT, "The change conflicts with existing data")
        }
    }
}
