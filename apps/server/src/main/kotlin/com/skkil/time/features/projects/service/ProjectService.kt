package com.skkil.time.features.projects.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.domain.Project
import com.skkil.time.features.projects.domain.ProjectInput
import com.skkil.time.features.projects.domain.ProjectRules
import com.skkil.time.features.projects.domain.ProjectSettings
import com.skkil.time.features.projects.repository.ProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@Transactional
class ProjectService(private val projects: ProjectRepository, private val groups: GroupService) {
    @Transactional(readOnly = true)
    fun get(user: Long, id: UUID): Project = projects.find(user, id).orNotFound("Project")

    @Transactional(readOnly = true)
    fun list(user: Long): List<Project> = projects.list(user)

    fun create(caller: Caller, input: ProjectInput, id: UUID? = null): Project {
        val name = validate(caller.id, input, moving = null)
        val id = id ?: caller.nextId()
        projects.insert(id, caller.id, input.parentId, name, input.color)
        return get(caller.id, id)
    }

    fun update(user: Long, id: UUID, input: ProjectInput): Project {
        val current = get(user, id)
        val name = validate(user, input, moving = id.takeIf { current.parentId != input.parentId })
        projects.update(user, id, input.parentId, name, input.color)
        return get(user, id)
    }

    fun setArchived(user: Long, id: UUID, archived: Boolean) {
        val subtree = projects.subtree(user, id)
        if (subtree.isEmpty()) get(user, id)
        if (!archived) {
            get(user, id).parentId?.let { parent ->
                ensure(!get(user, parent).archived) { "Restore the parent project first." }
            }
        }
        projects.setArchived(subtree.map { it.first }, archived)
    }

    fun setView(user: Long, id: UUID, view: String): Project {
        ensure(view in ProjectRules.VIEWS) { "Unknown view: $view" }
        ensureChanged(projects.setView(user, id, view), "Project")
        return get(user, id)
    }

    fun updateSettings(user: Long, id: UUID, settings: ProjectSettings): Project {
        val current = get(user, id)
        ensure(settings.status in ProjectRules.STATUSES) { "Unknown status: ${settings.status}" }
        ensure(settings.reviewEveryWeeks in ProjectRules.REVIEW_WEEKS) { "Review every 1, 2 or 4 weeks." }
        settings.weeklyMinutes?.let { ensure(it in 1..7 * 24 * 60) { "Weekly time must be within a week." } }
        ensure(settings.groupId == null || current.parentId == null) {
            "Sub-projects follow the group of the project they sit in."
        }
        settings.groupId?.let { groups.get(user, it) }
        val outcome = optionalText(settings.outcome, "Outcome", 300)
        val killCriteria = optionalText(settings.killCriteria, "Stop rule", 300)
        projects.updateSettings(user, id, settings, outcome, killCriteria)
        return get(user, id)
    }

    fun markReviewed(caller: Caller, id: UUID): Project {
        ensureChanged(projects.markReviewed(caller.id, id, caller.now()), "Project")
        return get(caller.id, id)
    }

    fun delete(user: Long, id: UUID) = ensureChanged(projects.delete(user, id), "Project")

    private fun validate(user: Long, input: ProjectInput, moving: UUID?): String {
        val name = requiredText(input.name, "Project name", 120)
        ensure(input.color in ProjectRules.COLORS) { "Unknown color: ${input.color}" }
        val parentId = input.parentId ?: return name
        val parent = get(user, parentId)
        ensure(!parent.archived) { "Can't add to an archived project." }
        val height =
            if (moving == null) {
                1
            } else {
                val descendants = projects.subtree(user, moving)
                if (descendants.any { it.first == parentId }) invalid("A project can't move inside itself.")
                descendants.maxOf { it.second }
            }
        ensure(projects.depth(parentId) + height <= ProjectRules.MAX_DEPTH) {
            "Projects nest at most ${ProjectRules.MAX_DEPTH} levels deep."
        }
        return name
    }
}
