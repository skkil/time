package com.skkil.time.features.imports.service

import com.skkil.time.common.error.DomainException
import com.skkil.time.common.error.invalid
import com.skkil.time.common.web.Caller
import com.skkil.time.features.imports.domain.ImportProject
import com.skkil.time.features.imports.domain.ImportTask
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.sections.domain.SectionInput
import com.skkil.time.features.sections.service.SectionService
import com.skkil.time.features.tasks.service.TaskService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** Turns converted CSV files into new projects in one transaction, so a bad row leaves nothing behind. */
@Service
@Transactional
class ImportService(
    private val projects: ProjectService,
    private val sections: SectionService,
    private val tasks: TaskService,
) {
    fun import(caller: Caller, items: List<ImportProject>): List<Long> = items.map { add(caller, it) }

    private fun add(caller: Caller, project: ImportProject): Long {
        val id = projects.create(caller.id, ProjectInput(project.name, null, project.color)).id
        addTasks(caller, project.tasks, id, null, null)
        for (section in project.sections) {
            val sectionId = sections.create(caller.id, SectionInput(id, section.name, null)).id
            addTasks(caller, section.tasks, id, sectionId, null)
        }
        return id
    }

    private fun addTasks(caller: Caller, items: List<ImportTask>, projectId: Long, sectionId: Long?, parentId: Long?) {
        for (item in items) {
            val input = item.task.copy(projectId = projectId, sectionId = sectionId, parentId = parentId)
            val task =
                try {
                    tasks.create(caller, input)
                } catch (error: DomainException) {
                    invalid("Couldn't import “${input.title}”: ${error.message}")
                }
            addTasks(caller, item.children, projectId, sectionId, task.id)
        }
    }
}
