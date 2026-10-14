package com.skkil.time.features.workflow.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.invalid
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.dateOrNull
import com.skkil.time.common.persistence.intOrNull
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.service.ProjectService
import com.skkil.time.features.workflow.domain.ItemStatus
import com.skkil.time.features.workflow.domain.ItemType
import com.skkil.time.features.workflow.domain.ItemTypeInput
import com.skkil.time.features.workflow.domain.Milestone
import com.skkil.time.features.workflow.domain.MilestoneInput
import com.skkil.time.features.workflow.domain.Preset
import com.skkil.time.features.workflow.domain.SavedView
import com.skkil.time.features.workflow.domain.StatusInput
import com.skkil.time.features.workflow.domain.ViewInput
import com.skkil.time.features.workflow.domain.Workflow
import com.skkil.time.features.workflow.domain.WorkflowRules
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.core.JacksonException
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.json.JsonMapper

/** Per-project item types, statuses, milestones and saved views, and the presets that set all four at once. */
@Service
@Transactional
class WorkflowService(
    private val jdbc: JdbcClient,
    private val projects: ProjectService,
    private val sync: WorkflowSync,
    private val mapper: JsonMapper,
) {
    @Transactional(readOnly = true)
    fun list(user: Long): Workflow =
        Workflow(
            types = query(user, "$SELECT_TYPE WHERE user_id = :user ORDER BY project_id, position, id", typeMapper),
            statuses =
                query(user, "$SELECT_STATUS WHERE user_id = :user ORDER BY project_id, position, id", statusMapper),
            milestones =
                query(
                    user,
                    """
                    SELECT id, project_id, name, date, position FROM milestone WHERE user_id = :user
                    ORDER BY project_id, date IS NULL, date, position, id
                    """,
                    milestoneMapper,
                ),
            views =
                query(
                    user,
                    """
                    SELECT id, project_id, name, layout, group_by, filter, sort, position FROM saved_view
                    WHERE user_id = :user ORDER BY project_id, position, id
                    """,
                    viewMapper,
                ),
        )

    @Transactional(readOnly = true)
    fun getType(
        user: Long,
        id: Long,
    ): ItemType = find(user, "$SELECT_TYPE WHERE user_id = :user AND id = :id", id, typeMapper).orNotFound("Type")

    @Transactional(readOnly = true)
    fun getStatus(user: Long, id: Long): ItemStatus =
        find(user, "$SELECT_STATUS WHERE user_id = :user AND id = :id", id, statusMapper).orNotFound("Status")

    fun createType(user: Long, projectId: Long, input: ItemTypeInput): Long {
        projects.get(user, projectId)
        val valid = checkType(input)
        return insertType(user, projectId, valid, nextPosition("item_type", projectId))
    }

    fun updateType(user: Long, id: Long, input: ItemTypeInput) {
        val current = getType(user, id)
        val valid = checkType(input)
        if (current.kind != "event" && valid.kind == "event") {
            val untimed =
                jdbc
                    .sql("SELECT COUNT(*) FROM task WHERE user_id = :user AND type_id = :id AND due_time IS NULL")
                    .param("user", user)
                    .param("id", id)
                    .query(Long::class.java)
                    .single()
            ensure(untimed == 0L) { "Some items of this type have no time yet. Events happen at a time." }
        }
        jdbc
            .sql(
                """
                UPDATE item_type SET name = :name, icon = :icon, kind = :kind, default_minutes = :minutes,
                  checklist = :checklist
                WHERE user_id = :user AND id = :id
                """,
            ).param("name", valid.name)
            .param("icon", valid.icon)
            .param("kind", valid.kind)
            .param("minutes", valid.defaultMinutes)
            .param("checklist", valid.checklist)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun deleteType(user: Long, id: Long, replacement: Long?) {
        val current = getType(user, id)
        replacement?.let {
            ensure(getType(user, it).projectId == current.projectId && it != id) {
                "Pick another type from the same project."
            }
        }
        jdbc
            .sql("UPDATE task SET type_id = CAST(:replacement AS BIGINT) WHERE user_id = :user AND type_id = :id")
            .param("replacement", replacement)
            .param("user", user)
            .param("id", id)
            .update()
        delete(user, "item_type", id)
    }

    fun createStatus(user: Long, projectId: Long, input: StatusInput): Long {
        projects.get(user, projectId)
        val valid = checkStatus(input)
        val id = insertStatus(user, projectId, valid, nextPosition("item_status", projectId))
        sync.reconcile(user)
        return id
    }

    fun updateStatus(caller: Caller, id: Long, input: StatusInput) {
        getStatus(caller.id, id)
        val valid = checkStatus(input)
        jdbc
            .sql("UPDATE item_status SET name = :name, category = :category WHERE user_id = :user AND id = :id")
            .param("name", valid.name)
            .param("category", valid.category)
            .param("user", caller.id)
            .param("id", id)
            .update()
        sync.syncCompletion(caller.id, caller.now(), "status_id = :id", "id", id)
    }

    fun reorderStatus(user: Long, id: Long, before: Long?) {
        val current = getStatus(user, id)
        val ids =
            jdbc
                .sql("SELECT id FROM item_status WHERE project_id = :project AND id <> :id ORDER BY position, id")
                .param("project", current.projectId)
                .param("id", id)
                .query { rs, _ -> rs.getLong("id") }
                .list()
                .toMutableList()
        ids.add(ids.indexOf(before).takeIf { it >= 0 } ?: ids.size, id)
        ids.forEachIndexed { position, status ->
            jdbc
                .sql("UPDATE item_status SET position = :position WHERE id = :id")
                .param("position", position)
                .param("id", status)
                .update()
        }
    }

    fun deleteStatus(caller: Caller, id: Long, replacement: Long?) {
        val user = caller.id
        val current = getStatus(user, id)
        if (replacement != null) {
            ensure(getStatus(user, replacement).projectId == current.projectId && replacement != id) {
                "Pick another status from the same project."
            }
        } else if (count("SELECT COUNT(*) FROM task WHERE status_id = :id", id) > 0) {
            val others =
                jdbc
                    .sql("SELECT COUNT(*) FROM item_status WHERE project_id = :project AND id <> :id")
                    .param("project", current.projectId)
                    .param("id", id)
                    .query(Long::class.java)
                    .single()
            ensure(others == 0L) { "Choose where its items go first." }
        }
        jdbc
            .sql(
                """
                UPDATE task SET status_id = CAST(:replacement AS BIGINT), status_changed_at = :now
                WHERE user_id = :user AND status_id = :id
                """,
            ).param("replacement", replacement)
            .param("now", caller.now())
            .param("user", user)
            .param("id", id)
            .update()
        delete(user, "item_status", id)
        sync.syncCompletion(user, caller.now(), "project_id = :project", "project", current.projectId)
    }

    fun createMilestone(user: Long, projectId: Long, input: MilestoneInput): Long {
        projects.get(user, projectId)
        return jdbc
            .sql(
                """
                INSERT INTO milestone (user_id, project_id, name, date, position)
                VALUES (:user, :project, :name, :date, :position) RETURNING id
                """,
            ).param("user", user)
            .param("project", projectId)
            .param("name", checkMilestone(input))
            .param("date", input.date)
            .param("position", nextPosition("milestone", projectId))
            .query(Long::class.java)
            .single()
    }

    fun updateMilestone(user: Long, id: Long, input: MilestoneInput) {
        val name = checkMilestone(input)
        val rows =
            jdbc
                .sql("UPDATE milestone SET name = :name, date = :date WHERE user_id = :user AND id = :id")
                .param("name", name)
                .param("date", input.date)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Milestone")
    }

    fun deleteMilestone(user: Long, id: Long) = ensureChanged(delete(user, "milestone", id), "Milestone")

    fun setMilestoneLabel(user: Long, projectId: Long, label: String) {
        val text = optionalText(label, "Milestone name", 40)
        val rows =
            jdbc
                .sql("UPDATE project SET milestone_label = :label WHERE user_id = :user AND id = :id")
                .param("label", text)
                .param("user", user)
                .param("id", projectId)
                .update()
        ensureChanged(rows, "Project")
    }

    fun createView(user: Long, projectId: Long, input: ViewInput): Long {
        projects.get(user, projectId)
        return insertView(user, projectId, checkView(input), nextPosition("saved_view", projectId))
    }

    fun updateView(user: Long, id: Long, input: ViewInput) {
        val valid = checkView(input)
        val rows =
            jdbc
                .sql(
                    """
                    UPDATE saved_view SET name = :name, layout = :layout, group_by = :groupBy, filter = :filter,
                      sort = :sort
                    WHERE user_id = :user AND id = :id
                    """,
                ).param("name", valid.name)
                .param("layout", valid.layout)
                .param("groupBy", valid.groupBy)
                .param("filter", valid.filter)
                .param("sort", valid.sort)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "View")
    }

    fun deleteView(user: Long, id: Long) = ensureChanged(delete(user, "saved_view", id), "View")

    fun applyPreset(user: Long, projectId: Long, preset: Preset) {
        projects.get(user, projectId)
        val types = preset.types.map(::checkType)
        val statuses = preset.statuses.map(::checkStatus)
        val views = preset.views.map(::checkView)
        val label = optionalText(preset.milestoneLabel, "Milestone name", 40)
        val key = optionalText(preset.key, "Preset", 40)
        types.forEachIndexed { position, input -> insertType(user, projectId, input, position) }
        statuses.forEachIndexed { position, input -> insertStatus(user, projectId, input, position) }
        views.forEachIndexed { position, input -> insertView(user, projectId, input, position) }
        jdbc
            .sql("UPDATE project SET preset = :key, milestone_label = :label WHERE user_id = :user AND id = :id")
            .param("key", key)
            .param("label", label)
            .param("user", user)
            .param("id", projectId)
            .update()
        sync.reconcile(user)
    }

    @Transactional(readOnly = true)
    fun exportPreset(user: Long, projectId: Long): Preset {
        val project = projects.get(user, projectId)
        val workflow = list(user)
        return Preset(
            key = "custom-${project.name.lowercase().replace(' ', '-')}",
            name = project.name,
            description = "",
            types =
                workflow.types
                    .filter { it.projectId == projectId }
                    .map { ItemTypeInput(it.name, it.icon, it.kind, it.defaultMinutes, it.checklist) },
            statuses = workflow.statuses.filter { it.projectId == projectId }.map { StatusInput(it.name, it.category) },
            milestoneLabel = project.milestoneLabel,
            views =
                workflow.views
                    .filter { it.projectId == projectId }
                    .map { ViewInput(it.name, it.layout, it.groupBy, it.filter, it.sort) },
        )
    }

    fun parsePreset(text: String): Preset {
        val preset =
            try {
                mapper.readValue(text, Preset::class.java)
            } catch (_: JacksonException) {
                invalid("That file isn't a skkil time preset.")
            }
        requiredText(preset.name, "Preset name", 60)
        preset.types.forEach(::checkType)
        preset.statuses.forEach(::checkStatus)
        preset.views.forEach(::checkView)
        return preset
    }

    private fun checkType(input: ItemTypeInput): ItemTypeInput {
        oneOf(input.kind, WorkflowRules.KINDS, "kind")
        val icon = input.icon.takeIf { it in WorkflowRules.ICONS } ?: "circle"
        input.defaultMinutes?.let { ensure(it in 1..24 * 60) { "Default length is 1 minute to 24 hours." } }
        ensure(input.checklist.lines().count { it.isNotBlank() } <= WorkflowRules.MAX_CHECKLIST) {
            "A checklist has at most ${WorkflowRules.MAX_CHECKLIST} items."
        }
        return ItemTypeInput(
            name = requiredText(input.name, "Type name", 40),
            icon = icon,
            kind = input.kind,
            defaultMinutes = input.defaultMinutes,
            checklist = optionalText(input.checklist, "Checklist", 2000),
        )
    }

    private fun checkStatus(input: StatusInput): StatusInput {
        oneOf(input.category, WorkflowRules.CATEGORIES, "category")
        return StatusInput(requiredText(input.name, "Status name", 40), input.category)
    }

    private fun checkMilestone(input: MilestoneInput): String = requiredText(input.name, "Milestone name", 80)

    private fun checkView(input: ViewInput): ViewInput {
        oneOf(input.layout, WorkflowRules.LAYOUTS, "layout")
        oneOf(input.groupBy, WorkflowRules.GROUPS, "grouping")
        oneOf(input.sort, WorkflowRules.SORTS, "sort")
        val filter =
            try {
                mapper.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(input.filter)
            } catch (_: JacksonException) {
                null
            }
        ensure(filter != null && !filter.isMissingNode) { "The view's filter isn't valid." }
        return input.copy(name = requiredText(input.name, "View name", 40))
    }

    private fun oneOf(value: String, allowed: List<String>, what: String) =
        ensure(value in allowed) { "Unknown $what: $value." }

    private fun insertType(user: Long, projectId: Long, input: ItemTypeInput, position: Int): Long =
        jdbc
            .sql(
                """
                INSERT INTO item_type (user_id, project_id, name, icon, kind, default_minutes, checklist, position)
                VALUES (:user, :project, :name, :icon, :kind, :minutes, :checklist, :position) RETURNING id
                """,
            ).param("user", user)
            .param("project", projectId)
            .param("name", input.name)
            .param("icon", input.icon)
            .param("kind", input.kind)
            .param("minutes", input.defaultMinutes)
            .param("checklist", input.checklist)
            .param("position", position)
            .query(Long::class.java)
            .single()

    private fun insertStatus(user: Long, projectId: Long, input: StatusInput, position: Int): Long =
        jdbc
            .sql(
                """
                INSERT INTO item_status (user_id, project_id, name, category, position)
                VALUES (:user, :project, :name, :category, :position) RETURNING id
                """,
            ).param("user", user)
            .param("project", projectId)
            .param("name", input.name)
            .param("category", input.category)
            .param("position", position)
            .query(Long::class.java)
            .single()

    private fun insertView(user: Long, projectId: Long, input: ViewInput, position: Int): Long =
        jdbc
            .sql(
                """
                INSERT INTO saved_view (user_id, project_id, name, layout, group_by, filter, sort, position)
                VALUES (:user, :project, :name, :layout, :groupBy, :filter, :sort, :position) RETURNING id
                """,
            ).param("user", user)
            .param("project", projectId)
            .param("name", input.name)
            .param("layout", input.layout)
            .param("groupBy", input.groupBy)
            .param("filter", input.filter)
            .param("sort", input.sort)
            .param("position", position)
            .query(Long::class.java)
            .single()

    private fun nextPosition(table: String, projectId: Long): Int =
        jdbc
            .sql("SELECT COALESCE(MAX(position), 0) + 1 FROM $table WHERE project_id = :project")
            .param("project", projectId)
            .query(Int::class.java)
            .single()

    private fun count(sql: String, id: Long): Long = jdbc.sql(sql).param("id", id).query(Long::class.java).single()

    private fun delete(user: Long, table: String, id: Long): Int =
        jdbc
            .sql("DELETE FROM $table WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .update()

    private fun <T : Any> query(user: Long, sql: String, mapper: RowMapper<T>): List<T> =
        jdbc.sql(sql).param("user", user).query(mapper).list()

    private fun <T : Any> find(user: Long, sql: String, id: Long, mapper: RowMapper<T>): T? =
        jdbc
            .sql(sql)
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)

    private companion object {
        const val SELECT_TYPE =
            "SELECT id, project_id, name, icon, kind, default_minutes, checklist, position FROM item_type"
        const val SELECT_STATUS = "SELECT id, project_id, name, category, position FROM item_status"

        val typeMapper =
            RowMapper { rs, _ ->
                ItemType(
                    id = rs.getLong("id"),
                    projectId = rs.getLong("project_id"),
                    name = rs.getString("name"),
                    icon = rs.getString("icon"),
                    kind = rs.getString("kind"),
                    defaultMinutes = rs.intOrNull("default_minutes"),
                    checklist = rs.getString("checklist"),
                    position = rs.getInt("position"),
                )
            }

        val statusMapper =
            RowMapper { rs, _ ->
                ItemStatus(
                    rs.getLong("id"),
                    rs.getLong("project_id"),
                    rs.getString("name"),
                    rs.getString("category"),
                    rs.getInt("position"),
                )
            }

        val milestoneMapper =
            RowMapper { rs, _ ->
                Milestone(
                    rs.getLong("id"),
                    rs.getLong("project_id"),
                    rs.getString("name"),
                    rs.dateOrNull("date"),
                    rs.getInt("position"),
                )
            }

        val viewMapper =
            RowMapper { rs, _ ->
                SavedView(
                    id = rs.getLong("id"),
                    projectId = rs.getLong("project_id"),
                    name = rs.getString("name"),
                    layout = rs.getString("layout"),
                    groupBy = rs.getString("group_by"),
                    filter = rs.getString("filter"),
                    sort = rs.getString("sort"),
                    position = rs.getInt("position"),
                )
            }
    }
}
