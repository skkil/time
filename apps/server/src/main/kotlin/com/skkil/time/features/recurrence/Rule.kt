package com.skkil.time.features.recurrence

import java.time.DayOfWeek
import java.time.LocalDate

private const val FORTNIGHT_DAYS = 14L
private const val WEEK_DAYS = 7L
private const val QUARTER_MONTHS = 3
private const val MAX_INTERVAL = 365

private fun nextWorkday(from: LocalDate): LocalDate {
    var next = from.plusDays(1)
    while (!isWorkday(next)) next = next.plusDays(1)
    return next
}

sealed interface Rule {
    data class Days(val n: Int) : Rule

    data class Weeks(val n: Int) : Rule

    data class Months(val n: Int) : Rule

    data class Years(val n: Int) : Rule

    data class Workdays(val n: Int) : Rule

    data class AlternateWeekday(val day: DayOfWeek) : Rule

    data class On(val days: List<DayPattern>) : Rule

    fun step(from: LocalDate): LocalDate =
        when (this) {
            is Days -> {
                from.plusDays(n.toLong())
            }

            is Weeks -> {
                from.plusDays(WEEK_DAYS * n)
            }

            is Months -> {
                from.plusMonths(n.toLong())
            }

            is Years -> {
                from.plusMonths(12L * n)
            }

            is Workdays -> {
                (0 until n).fold(from) { date, _ -> nextWorkday(date) }
            }

            is AlternateWeekday -> {
                firstWeekdayFrom(from.plusDays(FORTNIGHT_DAYS), day)
            }

            is On -> {
                generateSequence(from.plusDays(1)) { it.plusDays(1) }.first { date ->
                    days.any { it.matches(date) }
                }
            }
        }

    fun nextAfter(due: LocalDate, today: LocalDate): LocalDate {
        var next = step(due)
        while (next <= today) next = step(next)
        return next
    }

    /** The first date on or after [start] this rule lands on. With no chosen start, `every other fri` skips the next Friday, as Todoist does. */
    fun firstDate(start: LocalDate?, today: LocalDate): LocalDate {
        val from = start ?: today
        return when {
            this is Workdays -> {
                if (isWorkday(from)) from else nextWorkday(from)
            }

            this is AlternateWeekday -> {
                if (start != null) {
                    firstWeekdayFrom(from, day)
                } else {
                    firstWeekdayFrom(from.plusDays(1), day).plusDays(WEEK_DAYS)
                }
            }

            this is On -> {
                if (days.any { it.matches(from) }) from else step(from)
            }

            else -> {
                from
            }
        }
    }

    fun text(): String =
        when (this) {
            is Days -> plural(n, "day")
            is Weeks -> plural(n, "week")
            is Months -> plural(n, "month")
            is Years -> plural(n, "year")
            is Workdays -> if (n == 1) "every weekday" else "every $n workdays"
            is AlternateWeekday -> "every other ${weekdayName(day)}"
            is On -> "every " + days.joinToString(", ") { it.text() }
        }

    companion object {
        /** Reads what follows `every`, so `3 days`, `other fri` or `mon, 15th`. */
        fun parse(body: String): Rule? {
            val parts = words(body)
            when {
                parts == listOf("weekday") -> {
                    return Workdays(1)
                }

                parts == listOf("weekend") -> {
                    return On(listOf(DayPattern.Weekday(DayOfWeek.SATURDAY), DayPattern.Weekday(DayOfWeek.SUNDAY)))
                }

                parts.size == 2 && parts[0] == "other" -> {
                    return unit(parts[1], 2) ?: weekday(parts[1])?.let(::AlternateWeekday)
                }

                parts.size == 1 && unit(parts[0], 1) != null -> {
                    return unit(parts[0], 1)
                }

                parts.size == 2 -> {
                    val count = count(parts[0])
                    if (count != null && unit(parts[1], 1) != null) {
                        return if (count in 1..MAX_INTERVAL) unit(parts[1], count.toInt()) else null
                    }
                }
            }
            return parseDays(body)
        }

        private fun unit(word: String, count: Int): Rule? =
            when (word.trimEnd('s')) {
                "day" -> Days(count)
                "week" -> Weeks(count)
                "month" -> Months(count)
                "quarter" -> Months(count * QUARTER_MONTHS)
                "year" -> Years(count)
                "workday" -> Workdays(count)
                else -> null
            }

        private fun parseDays(body: String): Rule? {
            val days = mutableListOf<DayPattern>()
            for (term in body.replace(" and ", ", ").split(',').map { it.trim() }) {
                if (term.isEmpty()) continue
                val pattern = DayPattern.parse(term)
                if (pattern != null) {
                    days += pattern
                    continue
                }
                val spaced = words(term).map { DayPattern.parse(it) ?: return null }
                if (!spaced.all { it is DayPattern.Weekday }) return null
                days += spaced
            }
            if (days.isEmpty()) return null
            return On(days.sortedBy { it.sortKey() }.dedupe())
        }

        private fun <T> List<T>.dedupe(): List<T> =
            filterIndexed { index, item ->
                index == 0 || item != this[index - 1]
            }

        private fun plural(count: Int, unit: String): String =
            when (count) {
                1 -> "every $unit"
                2 -> "every other $unit"
                else -> "every $count ${unit}s"
            }
    }
}
