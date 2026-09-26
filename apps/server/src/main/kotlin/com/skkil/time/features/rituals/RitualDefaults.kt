package com.skkil.time.features.rituals

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component

/** The five ritual templates every new user starts with, as on desktop. */
@Component
class RitualDefaults(private val jdbc: JdbcClient) {
    fun seed(user: Long) {
        jdbc
            .sql(
                """
                INSERT INTO ritual (user_id, kind, enabled, trigger, at_minute, weekdays, steps) VALUES
                  (:user, 'morning', FALSE, 'first_open', 0, 127, 'feel,leftovers,pick_musts,timeblock'),
                  (:user, 'evening', FALSE, 'end_of_day', 1050, 127, 'what_moved,leftovers,habit_check,one_line_note'),
                  (:user, 'wind_down', FALSE, 'at_time', 1335, 127, 'brain_dump,habit_check,device_away'),
                  (:user, 'session', TRUE, 'after_timer_stop', 0, 127, 'did_it_move,next_step_note,breathing_pause'),
                  (:user, 'weekly', TRUE, 'first_open', 0, 1, 'weekly_review')
                ON CONFLICT DO NOTHING
                """,
            ).param("user", user)
            .update()
    }
}
