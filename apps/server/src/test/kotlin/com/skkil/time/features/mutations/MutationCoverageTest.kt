package com.skkil.time.features.mutations

import com.skkil.time.features.mutations.domain.DeviceOnlyCommands
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
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Every write command in the contract is a registered mutation with the contract's parameters, or device-only. */
class MutationCoverageTest {
    private val commands: Map<String, List<String>> =
        File("../shared/contract/src/bindings.ts")
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
    fun `reads the contract`() {
        assertTrue(commands.size > 120, "Found ${commands.size} commands in bindings.ts")
        assertEquals(listOf("id", "placement"), commands["moveTask"])
    }

    @Test
    fun `every write command is registered or device-only`() {
        val writes = commands.keys - READS
        val unclassified = writes - registered.keys - DeviceOnlyCommands.names.keys
        assertEquals(emptySet(), unclassified, "Register these mutations or list them as device-only")
        assertEquals(emptySet(), registered.keys - commands.keys, "Registered names missing from the contract")
        assertEquals(emptySet(), DeviceOnlyCommands.names.keys - commands.keys)
        assertEquals(emptySet(), registered.keys intersect DeviceOnlyCommands.names.keys)
        assertEquals(emptySet(), READS - commands.keys, "Reads missing from the contract")
        assertEquals(emptySet(), READS intersect registered.keys, "A read is registered as a mutation")
    }

    @Test
    fun `mutations take the contract's parameters in order`() {
        val mismatched = registered.filter { (name, params) -> commands[name] != params }
        assertEquals(emptyMap(), mismatched.mapValues { (name, params) -> "$params vs ${commands[name]}" })
    }

    private companion object {
        val COMMAND = Regex("""^\s+(\w+): \(([^)]*)\) => __TAURI_INVOKE""")
        val PARAM = Regex("""(\w+)\s*:""")
        val READS =
            setOf(
                "listProjects",
                "listGroups",
                "getProjectCanvas",
                "listTasks",
                "getTask",
                "listSections",
                "listBlocks",
                "listTimeEntries",
                "listTaskEntries",
                "listProjectEntries",
                "getTimer",
                "listHabits",
                "listHabitDays",
                "listDays",
                "getWeek",
                "listWeeks",
                "getQuarter",
                "listRituals",
                "getPlanningTime",
                "dueRitual",
                "listRitualRuns",
                "getWorkflow",
                "listPresets",
                "saveProjectPreset",
                "readPreset",
                "listEvents",
                "listTimeByType",
                "listRecordPhases",
                "externalChanges",
                "getCaptureHotkey",
                "getRemindersEnabled",
            )
    }
}
