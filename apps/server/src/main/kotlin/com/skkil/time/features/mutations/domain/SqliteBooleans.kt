package com.skkil.time.features.mutations.domain

import tools.jackson.core.JsonParser
import tools.jackson.core.JsonToken
import tools.jackson.databind.DeserializationContext
import tools.jackson.databind.ValueDeserializer
import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.module.SimpleModule

/**
 * Reads a boolean from `true`/`false` or the `1`/`0` a SQLite device may send, at any depth of a mutation's arguments.
 * Any other value is refused.
 */
object SqliteBooleans : ValueDeserializer<Boolean>() {
    override fun deserialize(parser: JsonParser, context: DeserializationContext): Boolean =
        when (parser.currentToken()) {
            JsonToken.VALUE_TRUE -> true
            JsonToken.VALUE_FALSE -> false
            JsonToken.VALUE_NUMBER_INT if parser.longValue == 1L -> true
            JsonToken.VALUE_NUMBER_INT if parser.longValue == 0L -> false
            else -> context.handleUnexpectedToken(Boolean::class.java, parser) as Boolean
        }

    /** [base] reading booleans this way. */
    fun mapper(base: JsonMapper): JsonMapper =
        base
            .rebuild()
            .addModule(
                SimpleModule("SqliteBooleans")
                    .addDeserializer(Boolean::class.javaObjectType, this)
                    .addDeserializer(Boolean::class.javaPrimitiveType!!, this),
            ).build()
}
