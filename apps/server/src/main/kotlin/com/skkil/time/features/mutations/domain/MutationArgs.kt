package com.skkil.time.features.mutations.domain

import com.skkil.time.common.error.invalid
import tools.jackson.core.JacksonException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.jacksonTypeRef

/** A mutation's arguments: one JSON object keyed by the contract's parameter names. */
class MutationArgs(
    @PublishedApi internal val node: JsonNode,
    @PublishedApi internal val mapper: JsonMapper,
) {
    /** The argument [name] as [T]; missing or `null` is allowed only when [T] is nullable. */
    inline fun <reified T> get(name: String): T {
        val field = node.get(name)?.takeUnless { it.isNull }
        val value =
            try {
                field?.let { mapper.convertValue(it, jacksonTypeRef<T>()) }
            } catch (_: JacksonException) {
                invalid("The “$name” argument isn't valid.")
            } catch (_: IllegalArgumentException) {
                invalid("The “$name” argument isn't valid.")
            }
        if (value == null && null !is T) invalid("The “$name” argument is missing.")
        return value as T
    }
}
