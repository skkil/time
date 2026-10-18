package com.skkil.time.features.review.service

import com.skkil.time.common.error.ensure
import com.skkil.time.common.error.ensureChanged
import com.skkil.time.common.error.orNotFound
import com.skkil.time.common.persistence.uuid
import com.skkil.time.common.text.optionalText
import com.skkil.time.common.text.requiredText
import com.skkil.time.common.web.Caller
import com.skkil.time.features.review.domain.Priority
import com.skkil.time.features.review.domain.PriorityInput
import com.skkil.time.features.review.domain.Quarter
import com.skkil.time.features.review.domain.QuarterInput
import com.skkil.time.features.review.domain.monday
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/** Quarters of 13 weeks, each with up to three priorities that weekly outcomes can serve. */
@Service
@Transactional
class QuarterService(private val jdbc: JdbcClient) {
    @Transactional(readOnly = true)
    fun at(user: Long, date: LocalDate): Quarter? {
        val monday = date.monday()
        val (id, label, startDate) =
            jdbc
                .sql(
                    """
                    SELECT id, label, start_date FROM quarter
                    WHERE user_id = :user AND start_date <= :monday ORDER BY start_date DESC LIMIT 1
                    """,
                ).param("user", user)
                .param("monday", monday)
                .query { rs, _ ->
                    Triple(rs.uuid("id"), rs.getString("label"), rs.getObject("start_date", LocalDate::class.java))
                }.optional()
                .orElse(null) ?: return null
        val weekNo = ChronoUnit.DAYS.between(startDate, monday) / 7 + 1
        if (weekNo > WEEKS_PER_QUARTER) return null
        val priorities =
            jdbc
                .sql(
                    """
                    SELECT p.id, p.title, p.note,
                      (SELECT COUNT(*) FROM outcome o
                        WHERE o.user_id = p.user_id AND o.priority_id = p.id AND o.status = 'achieved'
                          AND o.week_start >= :from AND o.week_start < :to) AS achieved
                    FROM priority p WHERE p.user_id = :user AND p.quarter_id = :quarter ORDER BY p.id
                    """,
                ).param("from", startDate)
                .param("to", startDate.plusWeeks(WEEKS_PER_QUARTER))
                .param("user", user)
                .param("quarter", id)
                .query { rs, _ ->
                    Priority(rs.uuid("id"), rs.getString("title"), rs.getString("note"), rs.getInt("achieved"))
                }.list()
        return Quarter(id, label, startDate, weekNo.toInt(), priorities)
    }

    fun create(caller: Caller, input: QuarterInput, id: UUID? = null): UUID {
        val id = id ?: caller.nextId()
        jdbc
            .sql("INSERT INTO quarter (id, user_id, label, start_date) VALUES (:id, :user, :label, :start)")
            .param("id", id)
            .param("user", caller.id)
            .param("label", label(input))
            .param("start", input.startDate.monday())
            .update()
        return id
    }

    fun update(user: Long, id: UUID, input: QuarterInput): UUID {
        val rows =
            jdbc
                .sql("UPDATE quarter SET label = :label, start_date = :start WHERE user_id = :user AND id = :id")
                .param("label", label(input))
                .param("start", input.startDate.monday())
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Quarter")
        return id
    }

    fun addPriority(caller: Caller, quarterId: UUID, title: String, id: UUID? = null) {
        val user = caller.id
        val text = requiredText(title, "Priority", 200)
        val count =
            jdbc
                .sql(
                    """
                    SELECT COUNT(p.id) FROM quarter q LEFT JOIN priority p ON p.quarter_id = q.id
                    WHERE q.user_id = :user AND q.id = :quarter GROUP BY q.id
                    """,
                ).param("user", user)
                .param("quarter", quarterId)
                .query(Int::class.java)
                .optional()
                .orElse(null)
                .orNotFound("Quarter")
        ensure(count < MAX_PRIORITIES) { "3 priorities max. Remove one first." }
        jdbc
            .sql("INSERT INTO priority (id, user_id, quarter_id, title) VALUES (:id, :user, :quarter, :title)")
            .param("id", id ?: caller.nextId())
            .param("user", user)
            .param("quarter", quarterId)
            .param("title", text)
            .update()
    }

    fun editPriority(user: Long, id: UUID, input: PriorityInput) {
        val title = requiredText(input.title, "Priority", 200)
        val note = optionalText(input.note, "Note", 2_000)
        val rows =
            jdbc
                .sql("UPDATE priority SET title = :title, note = :note WHERE user_id = :user AND id = :id")
                .param("title", title)
                .param("note", note)
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Priority")
    }

    fun deletePriority(user: Long, id: UUID) {
        val rows =
            jdbc
                .sql("DELETE FROM priority WHERE user_id = :user AND id = :id")
                .param("user", user)
                .param("id", id)
                .update()
        ensureChanged(rows, "Priority")
    }

    private fun label(input: QuarterInput) = requiredText(input.label, "Quarter name", 40)

    private companion object {
        const val WEEKS_PER_QUARTER = 13L
        const val MAX_PRIORITIES = 3
    }
}
