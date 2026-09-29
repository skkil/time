package com.skkil.time.features.recurrence

import java.time.LocalDate
import java.time.format.DateTimeParseException

/**
 * A repeat as stored on a task: its rule, whether the next date counts from completion (`every!`) instead of the
 * due date, and an inclusive last date.
 */
data class Recurrence(val rule: Rule, val fromCompletion: Boolean, val ends: LocalDate?) {
    private fun withinEnd(date: LocalDate): LocalDate? = date.takeIf { ends == null || it <= ends }

    /** The date after finishing, or `null` once the repeat has run out. */
    fun nextAfter(due: LocalDate, today: LocalDate): LocalDate? =
        withinEnd(rule.nextAfter(if (fromCompletion) today else due, today))

    fun following(date: LocalDate): LocalDate? = withinEnd(rule.step(date))

    fun firstDate(start: LocalDate?, today: LocalDate): LocalDate = rule.firstDate(start, today)

    override fun toString(): String {
        val text = rule.text()
        val head = if (fromCompletion) FROM_COMPLETION + text.removePrefix(EVERY) else text
        return if (ends == null) head else "$head ending $ends"
    }

    companion object {
        private const val EVERY = "every"
        private const val FROM_COMPLETION = "every!"
        private val ALIASES =
            mapOf(
                "daily" to "day",
                "everyday" to "day",
                "weekly" to "week",
                "monthly" to "month",
                "quarterly" to "quarter",
                "yearly" to "year",
                "annually" to "year",
            )
        private val PREFIXES = listOf("every!" to true, "ev!" to true, "after" to true, "every" to false, "ev" to false)

        fun parse(text: String): Recurrence? {
            val lower = text.trim().lowercase()
            val ending = lower.split(" ending ").getOrNull(1)
            val ends =
                if (ending == null) {
                    null
                } else {
                    val date = words(ending).firstOrNull() ?: return null
                    try {
                        LocalDate.parse(date)
                    } catch (_: DateTimeParseException) {
                        return null
                    }
                }
            val stripped = cutAt(cutAt(cutAt(lower, " ending "), " at "), " starting").trim()
            val (body, fromCompletion) = bodyOf(stripped) ?: return null
            return Rule.parse(body)?.let { Recurrence(it, fromCompletion, ends) }
        }

        private fun cutAt(text: String, marker: String): String = text.substringBefore(marker)

        private fun bodyOf(text: String): Pair<String, Boolean>? {
            ALIASES[text]?.let { return it to false }
            for ((prefix, fromCompletion) in PREFIXES) {
                val body = text.removePrefix(prefix)
                if (body.length < text.length && body.startsWith(' ')) return body.trim() to fromCompletion
            }
            return null
        }
    }
}
