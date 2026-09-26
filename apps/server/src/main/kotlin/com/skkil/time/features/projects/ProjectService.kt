package com.skkil.time.features.projects

import com.skkil.time.common.Caller
import com.skkil.time.common.ensure
import com.skkil.time.common.ensureChanged
import com.skkil.time.common.invalid
import com.skkil.time.common.optionalText
import com.skkil.time.common.orNotFound
import com.skkil.time.common.requiredText
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ProjectService(private val projects: ProjectRepository, private val groups: GroupService) {
    @Transactional(readOnly = true)
    fun get(user: Long, id: Long): Project = projects.find(user, id).orNotFound("Project")

    @Transactional(readOnly = true)
    fun list(user: Long): List<Project> = projects.list(user)

    fun create(user: Long, input: ProjectInput): Project {
        val name = validate(user, input, moving = null)
        return get(user, projects.insert(user, input.parentId, name, input.color))
    }

    fun update(user: Long, id: Long, input: ProjectInput): Project {
        val current = get(user, id)
        val name = validate(user, input, moving = id.takeIf { current.parentId != input.parentId })
        projects.update(user, id, input.parentId, name, input.color)
        return get(user, id)
    }

    fun setArchived(user: Long, id: Long, archived: Boolean) {
        val subtree = projects.subtree(user, id)
        if (subtree.isEmpty()) get(user, id)
        if (!archived) {
            get(user, id).parentId?.let { parent ->
                ensure(!get(user, parent).archived) { "Restore the parent project first." }
            }
        }
        projects.setArchived(subtree.map { it.first }, archived)
    }

    fun setView(user: Long, id: Long, view: String): Project {
        ensure(view in ProjectRules.VIEWS) { "Unknown view: $view" }
        ensureChanged(projects.setView(user, id, view), "Project")
        return get(user, id)
    }

    fun updateSettings(user: Long, id: Long, settings: ProjectSettings): Project {
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

    fun markReviewed(caller: Caller, id: Long): Project {
        ensureChanged(projects.markReviewed(caller.id, id, caller.now()), "Project")
        return get(caller.id, id)
    }

    fun delete(user: Long, id: Long) = ensureChanged(projects.delete(user, id), "Project")

    private fun validate(user: Long, input: ProjectInput, moving: Long?): String {
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
