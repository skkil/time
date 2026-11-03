package com.skkil.time.features.mutations.service

import com.skkil.time.features.data.domain.LocalData
import com.skkil.time.features.data.service.DataService
import com.skkil.time.features.data.service.LocalImportService
import com.skkil.time.features.imports.domain.ImportProject
import com.skkil.time.features.imports.service.ImportService
import com.skkil.time.features.mutations.domain.Mutation.Companion.mutation
import com.skkil.time.features.mutations.domain.MutationSet
import com.skkil.time.features.settings.repository.SettingsRepository
import org.springframework.stereotype.Component

@Component
class DataMutations(
    private val imports: ImportService,
    private val data: DataService,
    private val settings: SettingsRepository,
    private val local: LocalImportService,
) : MutationSet {
    override val mutations =
        listOf(
            mutation("importProjects", "projects") { caller, args ->
                imports.import(caller, args.get<List<ImportProject>>("projects"))
            },
            mutation("setRemindersEnabled", "enabled") { caller, args ->
                settings.write(caller, "reminders_enabled", if (args.get<Boolean>("enabled")) "on" else "off")
            },
            mutation("deleteAllData") { caller, args ->
                data.deleteAll(caller)
            },
            mutation("importLocal", "data") { caller, args ->
                local.import(caller, args.get<LocalData>("data"))
            },
        )
}
