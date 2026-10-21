package com.skkil.time.features.mutations.domain

import com.skkil.time.common.web.Caller

/** One write command: its contract name, the contract's parameter names in order, and the service call it makes. */
class Mutation(val name: String, val params: List<String>, val apply: (Caller, MutationArgs) -> Any?) {
    companion object {
        fun mutation(name: String, vararg params: String, apply: (Caller, MutationArgs) -> Any?) =
            Mutation(name, params.toList(), apply)
    }
}
