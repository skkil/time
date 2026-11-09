package com.skkil.time.features.mutations

import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.mutations.service.DataMutations
import com.skkil.time.features.mutations.service.HabitMutations
import com.skkil.time.features.mutations.service.ProjectMutations
import com.skkil.time.features.mutations.service.RecordMutations
import com.skkil.time.features.mutations.service.ReviewMutations
import com.skkil.time.features.mutations.service.RitualMutations
import com.skkil.time.features.mutations.service.SectionMutations
import com.skkil.time.features.mutations.service.TaskMutations
import com.skkil.time.features.mutations.service.TimeMutations
import com.skkil.time.features.mutations.service.WorkflowMutations
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import tools.jackson.databind.json.JsonMapper
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * The registry is exactly the `mutations` and `syncMutations` of `commands.json`, never a read or a device-only
 * command, and each mutation takes the contract's parameters in order. A category this test doesn't know fails it, so
 * a new one is classified here first.
 */
class MutationCoverageTest {
    private val classified = JsonMapper.builder().build().readTree(File("../shared/client/src/types/commands.json"))

    private fun names(kind: String): Set<String> = classified[kind].values().map { it.asString() }.toSet()

    private val parameters: Map<String, List<String>> =
        File("../shared/client/src/types/bindings.ts")
            .readLines()
            .mapNotNull { COMMAND.find(it) }
            .associate { match ->
                match.groupValues[1] to PARAM.findAll(match.groupValues[2]).map { it.groupValues[1] }.toList()
            }

    private val registered =
        listOf(
            ProjectMutations::class.java,
            TaskMutations::class.java,
            SectionMutations::class.java,
            TimeMutations::class.java,
            HabitMutations::class.java,
            ReviewMutations::class.java,
            RitualMutations::class.java,
            WorkflowMutations::class.java,
            RecordMutations::class.java,
            DataMutations::class.java,
        ).flatMap { type ->
            val constructor = type.constructors.single()
            val set = constructor.newInstance(*constructor.parameterTypes.map { Mockito.mock(it) }.toTypedArray())
            (set as MutationSet).mutations
        }.associate { it.name to it.params }

    @Test
    fun `knows every category of the classification`() {
        val categories = classified.propertyNames().filterNot { it.startsWith("$") }.toSet()
        assertEquals(REGISTERED + UNREGISTERED, categories)
    }

    @Test
    fun `reads the classification and the contract`() {
        assertTrue(names("mutations").size > 80, "Found ${names("mutations").size} mutations in commands.json")
        assertEquals(listOf("id", "placement"), parameters["moveTask"])
        val commands = names("mutations") + UNREGISTERED.flatMap(::names)
        assertEquals(parameters.keys, commands, "commands.json and bindings.ts list different commands")
    }

    @Test
    fun `registers exactly the contract's mutations and the sync-only ones`() {
        assertEquals(REGISTERED.flatMap(::names).toSet(), registered.keys)
    }

    @Test
    fun `mutations take the contract's parameters in order`() {
        val expected = parameters + SYNC_PARAMETERS
        val mismatched = registered.filter { (name, params) -> expected[name] != params }
        assertEquals(emptyMap(), mismatched.mapValues { (name, params) -> "$params vs ${expected[name]}" })
    }

    private companion object {
        val REGISTERED = setOf("mutations", "syncMutations")
        val UNREGISTERED = setOf("reads", "deviceOnly")

        /** Sync-only mutations have no contract command; their arguments are fixed by the sync rules in AGENTS.md. */
        val SYNC_PARAMETERS = mapOf("importLocal" to listOf("data"))
        val COMMAND = Regex("""^\s+(\w+): \(([^)]*)\) => __TAURI_INVOKE""")
        val PARAM = Regex("""(\w+)\s*:""")
    }
}
