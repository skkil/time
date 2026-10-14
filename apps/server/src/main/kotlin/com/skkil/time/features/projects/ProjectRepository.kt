package com.skkil.time.features.projects

import com.skkil.time.common.persistence.dateOrNull
import com.skkil.time.common.persistence.intOrNull
import com.skkil.time.common.persistence.longOrNull
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
class ProjectRepository(private val jdbc: JdbcClient) {
    fun find(user: Long, id: Long): Project? =
        jdbc
            .sql("$SELECT WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .query(mapper)
            .optional()
            .orElse(null)

    fun list(user: Long): List<Project> =
        jdbc
            .sql("$SELECT WHERE user_id = :user ORDER BY position, id")
            .param("user", user)
            .query(mapper)
            .list()

    fun depth(id: Long): Int =
        jdbc
            .sql(
                """
                WITH RECURSIVE up(id, parent_id, depth) AS (
                  SELECT id, parent_id, 1 FROM project WHERE id = :id
                  UNION ALL
                  SELECT p.id, p.parent_id, up.depth + 1 FROM project p JOIN up ON p.id = up.parent_id
                )
                SELECT COALESCE(MAX(depth), 0) FROM up
                """,
            ).param("id", id)
            .query(Int::class.java)
            .single()

    /** The project and everything under it, with each one's depth below [id] (the root is 1). */
    fun subtree(user: Long, id: Long): List<Pair<Long, Int>> =
        jdbc
            .sql(
                """
                WITH RECURSIVE down(id, depth) AS (
                  SELECT id, 1 FROM project WHERE id = :id AND user_id = :user
                  UNION ALL
                  SELECT p.id, down.depth + 1 FROM project p JOIN down ON p.parent_id = down.id
                )
                SELECT id, depth FROM down
                """,
            ).param("user", user)
            .param("id", id)
            .query { rs, _ -> rs.getLong("id") to rs.getInt("depth") }
            .list()

    fun insert(user: Long, parentId: Long?, name: String, color: String): Long =
        jdbc
            .sql(
                """
                INSERT INTO project (user_id, parent_id, name, color, position, review_every_weeks)
                VALUES (:user, :parent, :name, :color,
                        (SELECT COALESCE(MAX(position), 0) + 1 FROM project WHERE user_id = :user), 1)
                RETURNING id
                """,
            ).param("user", user)
            .param("parent", parentId)
            .param("name", name)
            .param("color", color)
            .query(Long::class.java)
            .single()

    fun update(user: Long, id: Long, parentId: Long?, name: String, color: String) {
        jdbc
            .sql(
                """
                UPDATE project SET parent_id = :parent, name = :name, color = :color,
                  group_id = CASE WHEN CAST(:parent AS BIGINT) IS NULL THEN group_id END
                WHERE user_id = :user AND id = :id
                """,
            ).param("parent", parentId)
            .param("name", name)
            .param("color", color)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun setArchived(ids: List<Long>, archived: Boolean) {
        jdbc
            .sql("UPDATE project SET archived = :archived WHERE id IN (:ids)")
            .param("archived", archived)
            .param("ids", ids)
            .update()
    }

    fun setView(user: Long, id: Long, view: String): Int =
        jdbc
            .sql("UPDATE project SET view = :view WHERE user_id = :user AND id = :id")
            .param("view", view)
            .param("user", user)
            .param("id", id)
            .update()

    fun updateSettings(user: Long, id: Long, settings: ProjectSettings, outcome: String, killCriteria: String) {
        jdbc
            .sql(
                """
                UPDATE project SET group_id = :group, status = :status, outcome = :outcome,
                  weekly_minutes = :weekly, target_date = :target, kill_criteria = :kill,
                  review_every_weeks = :review, in_order = :inOrder
                WHERE user_id = :user AND id = :id
                """,
            ).param("group", settings.groupId)
            .param("status", settings.status)
            .param("outcome", outcome)
            .param("weekly", settings.weeklyMinutes)
            .param("target", settings.targetDate)
            .param("kill", killCriteria)
            .param("review", settings.reviewEveryWeeks)
            .param("inOrder", settings.inOrder)
            .param("user", user)
            .param("id", id)
            .update()
    }

    fun markReviewed(user: Long, id: Long, at: Long): Int =
        jdbc
            .sql("UPDATE project SET last_reviewed_at = :at WHERE user_id = :user AND id = :id")
            .param("at", at)
            .param("user", user)
            .param("id", id)
            .update()

    fun delete(user: Long, id: Long): Int =
        jdbc
            .sql("DELETE FROM project WHERE user_id = :user AND id = :id")
            .param("user", user)
            .param("id", id)
            .update()

    private companion object {
        const val SELECT = """
            SELECT id, parent_id, name, color, position, archived, view, group_id, status, outcome,
              weekly_minutes, target_date, kill_criteria, review_every_weeks, last_reviewed_at,
              in_order, preset, milestone_label
            FROM project"""

        val mapper =
            RowMapper { rs, _ ->
                Project(
                    id = rs.getLong("id"),
                    parentId = rs.longOrNull("parent_id"),
                    name = rs.getString("name"),
                    color = rs.getString("color"),
                    position = rs.getInt("position"),
                    archived = rs.getBoolean("archived"),
                    view = rs.getString("view"),
                    groupId = rs.longOrNull("group_id"),
                    status = rs.getString("status"),
                    outcome = rs.getString("outcome"),
                    weeklyMinutes = rs.intOrNull("weekly_minutes"),
                    targetDate = rs.dateOrNull("target_date"),
                    killCriteria = rs.getString("kill_criteria"),
                    reviewEveryWeeks = rs.getInt("review_every_weeks"),
                    lastReviewedAt = rs.longOrNull("last_reviewed_at"),
                    inOrder = rs.getBoolean("in_order"),
                    preset = rs.getString("preset"),
                    milestoneLabel = rs.getString("milestone_label"),
                )
            }
    }
}
