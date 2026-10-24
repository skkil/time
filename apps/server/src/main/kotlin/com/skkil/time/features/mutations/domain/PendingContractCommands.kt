package com.skkil.time.features.mutations.domain

/**
 * Mutations the server already registers that the Rust contract (`bindings.ts`) does not declare yet. Remove a name
 * once the desktop command lands; `MutationCoverageTest` fails while one is listed and in the contract.
 */
object PendingContractCommands {
    val names: Map<String, List<String>> =
        mapOf(
            "recordHabitMeasurements" to listOf("measurements"),
        )
}
