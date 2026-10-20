package com.skkil.time.features.rituals.service

import com.skkil.time.common.id.IdGenerator
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component

/** The five ritual templates every new user starts with, as on desktop. */
@Component
class RitualDefaults(private val jdbc: JdbcClient) {
    fun seed(user: Long, ids: IdGenerator) {
        for (template in TEMPLATES) {
            val (kind, enabled, trigger) = template
            jdbc
                .sql(
                    """
                    INSERT INTO ritual (id, user_id, kind, enabled, trigger, at_minute, weekdays, steps)
                    VALUES (:id, :user, :kind, :enabled, :trigger, :atMinute, :weekdays, :steps)
                    ON CONFLICT (user_id, kind) DO NOTHING
                    """,
                ).param("id", ids.next())
                .param("user", user)
                .param("kind", kind)
                .param("enabled", enabled)
                .param("trigger", trigger)
                .param("atMinute", template.atMinute)
                .param("weekdays", template.weekdays)
                .param("steps", template.steps)
                .update()
        }
    }

    private data class Template(
        val kind: String,
        val enabled: Boolean,
        val trigger: String,
        val atMinute: Int,
        val weekdays: Int,
        val steps: String,
    )

    private companion object {
        val TEMPLATES =
            listOf(
                Template("morning", false, "first_open", 0, 127, "feel,leftovers,pick_musts,timeblock"),
                Template("evening", false, "end_of_day", 1050, 127, "what_moved,leftovers,habit_check,one_line_note"),
                Template("wind_down", false, "at_time", 1335, 127, "brain_dump,habit_check,device_away"),
                Template("session", true, "after_timer_stop", 0, 127, "did_it_move,next_step_note,breathing_pause"),
                Template("weekly", true, "first_open", 0, 1, "weekly_review"),
            )
    }
}
