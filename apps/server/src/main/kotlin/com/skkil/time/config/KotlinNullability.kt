package com.skkil.time.config

import io.swagger.v3.core.converter.AnnotatedType
import io.swagger.v3.core.converter.ModelConverter
import io.swagger.v3.core.converter.ModelConverterContext
import io.swagger.v3.core.util.Json
import io.swagger.v3.oas.models.media.Schema
import kotlin.reflect.full.memberProperties

/**
 * Jackson writes every property, nulls included, so every property of a Kotlin class is required,
 * and the ones Kotlin marks nullable may be `null`. This keeps generated TypeScript types exact.
 */
class KotlinNullability : ModelConverter {
    override fun resolve(
        type: AnnotatedType,
        context: ModelConverterContext,
        chain: Iterator<ModelConverter>,
    ): Schema<*>? {
        val resolved = if (chain.hasNext()) chain.next().resolve(type, context, chain) else null
        val raw = runCatching { Json.mapper().constructType(type.type).rawClass }.getOrNull() ?: return resolved
        if (!raw.isAnnotationPresent(Metadata::class.java) || raw.isEnum) return resolved
        val definition = context.definedModels[raw.simpleName] ?: resolved ?: return resolved
        val properties = definition.properties ?: return resolved
        val nullable =
            runCatching {
                raw.kotlin.memberProperties.filter { it.returnType.isMarkedNullable }.map { it.name }.toSet()
            }
                .getOrDefault(emptySet())
        properties.replaceAll { name, property -> if (name in nullable) orNull(property) else property }
        definition.required = properties.keys.toList()
        return resolved
    }

    private fun orNull(property: Schema<*>): Schema<*> {
        if (property.`$ref` != null) {
            return Schema<Any>().anyOf(listOf(property, Schema<Any>().apply { addType("null") }))
        }
        val types = property.types ?: property.type?.let { setOf(it) } ?: return property
        if ("null" !in types) property.types = types + "null"
        return property
    }
}
