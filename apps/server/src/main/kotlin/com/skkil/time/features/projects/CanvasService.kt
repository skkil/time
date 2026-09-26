package com.skkil.time.features.projects

import com.skkil.time.common.Caller
import com.skkil.time.common.ensure
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** One free-form HTML document per project, shown as its Notes tab. */
@Service
@Transactional
class CanvasService(private val jdbc: JdbcClient, private val projects: ProjectService) {
    @Transactional(readOnly = true)
    fun get(user: Long, projectId: Long): ProjectCanvas {
        projects.get(user, projectId)
        return jdbc
            .sql("SELECT content, updated_at FROM project_canvas WHERE project_id = :id")
            .param("id", projectId)
            .query { rs, _ -> ProjectCanvas(projectId, rs.getString("content"), rs.getLong("updated_at")) }
            .optional()
            .orElse(ProjectCanvas(projectId, "", null))
    }

    fun save(caller: Caller, projectId: Long, content: String): ProjectCanvas {
        projects.get(caller.id, projectId)
        ensure(content.toByteArray().size <= ProjectRules.MAX_CANVAS) { "The canvas is too large to save." }
        jdbc
            .sql(
                """
                INSERT INTO project_canvas (project_id, content, updated_at) VALUES (:id, :content, :now)
                ON CONFLICT (project_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
                """,
            ).param("id", projectId)
            .param("content", content)
            .param("now", caller.now())
            .update()
        return get(caller.id, projectId)
    }
}
