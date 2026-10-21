package com.skkil.time.features.projects.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.web.Caller
import com.skkil.time.features.projects.domain.ProjectCanvas
import com.skkil.time.features.projects.domain.ProjectRules
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** One free-form HTML document per project, shown as its Notes tab. */
@Service
@Transactional
class CanvasService(private val jdbc: JdbcClient, private val projects: ProjectService) {
    @Transactional(readOnly = true)
    fun get(user: Long, projectId: UUID): ProjectCanvas {
        projects.get(user, projectId)
        return jdbc
            .sql("SELECT content, updated_at FROM project_canvas WHERE project_id = :id")
            .param("id", projectId)
            .query { rs, _ -> ProjectCanvas(projectId, rs.getString("content"), rs.getLong("updated_at")) }
            .optional()
            .orElse(ProjectCanvas(projectId, "", null))
    }

    fun save(caller: Caller, projectId: UUID, content: String): ProjectCanvas {
        projects.get(caller.id, projectId)
        ensure(content.toByteArray().size <= ProjectRules.MAX_CANVAS) { "The canvas is too large to save." }
        jdbc
            .sql(
                """
                INSERT INTO project_canvas (id, project_id, content, updated_at) VALUES (:canvas, :id, :content, :now)
                ON CONFLICT (project_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
                """,
            ).param("canvas", caller.nextId())
            .param("id", projectId)
            .param("content", content)
            .param("now", caller.now())
            .update()
        return get(caller.id, projectId)
    }
}
