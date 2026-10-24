package com.skkil.time.features.sync.service

import com.skkil.time.common.clock.MutationClock
import com.skkil.time.common.id.IdGenerator
import com.skkil.time.common.web.Caller
import com.skkil.time.features.mutations.domain.MutationDispatcher
import com.skkil.time.security.AccountService
import org.skkil.store.push.MutationContext
import org.skkil.store.push.MutationHandler
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode

/**
 * A pushed mutation run through time's [MutationDispatcher]: as the scope's owner, at the mutation's HLC, naming new
 * rows with the ids the device derived. It joins the transaction store's Push handler opened.
 */
@Component
class DispatchedMutation(
    private val dispatcher: MutationDispatcher,
    private val accounts: AccountService,
) : MutationHandler {
    override fun handle(args: JsonNode, context: MutationContext) {
        val account = checkNotNull(accounts.findByScope(context.scope)) { "No account owns scope ${context.scope}" }
        val caller = Caller(account.id, account.scopeId, account.zone)
        dispatcher.dispatch(caller, context.mutationName, args, clockOf(context), IdGenerator(context::nextId))
    }

    private fun clockOf(context: MutationContext): MutationClock =
        if (context.hlc > 0) MutationClock.fromHlc(context.hlc) else MutationClock.fixed(context.now())
}
