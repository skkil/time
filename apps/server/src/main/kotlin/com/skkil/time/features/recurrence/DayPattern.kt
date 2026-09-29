package com.skkil.time.features.recurrence

import java.time.DayOfWeek
import java.time.LocalDate

private val WEEKDAYS = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
private val WEEKDAY_NAMES = listOf("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
private val WEEKDAY_ALIASES =
    mapOf(
        "tues" to DayOfWeek.TUESDAY,
        "thur" to DayOfWeek.THURSDAY,
        "thurs" to DayOfWeek.THURSDAY,
    )
private val MONTHS = listOf("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
private val MONTH_NAMES =
    listOf(
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    )
private val ORDINAL_WORDS = listOf("first", "second", "third", "fourth", "fifth")
private const val MAX_WORKDAYS_IN_MONTH = 23
private const val MAX_WEEKDAY_ORDINAL = 5
private const val LEAP_YEAR = 2024
private const val MAX_U32 = 0xFFFF_FFFFL

internal fun words(text: String): List<String> = text.split(Regex("\\s+")).filter { it.isNotEmpty() }

internal fun weekday(word: String): DayOfWeek? {
    val index = WEEKDAYS.indexOf(word).takeIf { it >= 0 } ?: WEEKDAY_NAMES.indexOf(word).takeIf { it >= 0 }
    return index?.let { DayOfWeek.of(it + 1) } ?: WEEKDAY_ALIASES[word]
}

internal fun weekdayName(day: DayOfWeek): String = WEEKDAYS[day.value - 1]

private fun month(word: String): Int? {
    val name = word.trimEnd('.')
    val index =
        MONTHS.indexOf(name).takeIf { it >= 0 }
            ?: MONTH_NAMES.indexOf(name).takeIf { it >= 0 }
            ?: 8.takeIf { name == "sept" }
    return index?.plus(1)
}

private fun monthName(month: Int): String = MONTHS[month - 1]

/** A non-negative number that fits in 32 bits, as Rust's `u32` parse reads it. */
internal fun count(word: String): Long? = word.toLongOrNull()?.takeIf { it in 0..MAX_U32 }

private fun number(word: String): Long? =
    count(listOf("st", "nd", "rd", "th").firstOrNull { word.endsWith(it) }?.let { word.removeSuffix(it) } ?: word)

private fun ordinal(value: Long): String {
    val suffix =
        when {
            value % 100 in 11..13 -> "th"
            value % 10 == 1L -> "st"
            value % 10 == 2L -> "nd"
            value % 10 == 3L -> "rd"
            else -> "th"
        }
    return "$value$suffix"
}

internal fun isWorkday(date: LocalDate): Boolean = date.dayOfWeek.value <= 5

private fun workdaysThrough(date: LocalDate): Int = (1..date.dayOfMonth).count { isWorkday(date.withDayOfMonth(it)) }

private fun isLastWorkday(date: LocalDate): Boolean =
    isWorkday(date) && (date.dayOfMonth + 1..date.lengthOfMonth()).none { isWorkday(date.withDayOfMonth(it)) }

internal fun firstWeekdayFrom(date: LocalDate, day: DayOfWeek): LocalDate =
    date.plusDays(((7 + day.value - date.dayOfWeek.value) % 7).toLong())

sealed interface Nth {
    data class Ordinal(val n: Long) : Nth {
        override fun toString() = ordinal(n)
    }

    data object Last : Nth {
        override fun toString() = "last"
    }

    fun within(limit: Int): Boolean = this is Last || (this is Ordinal && n in 1..limit)

    companion object {
        fun parse(word: String): Nth? {
            if (word == "last") return Last
            val index = ORDINAL_WORDS.indexOf(word)
            if (index >= 0) return Ordinal(index + 1L)
            return number(word)?.takeIf { word.last().isLetter() }?.let(::Ordinal)
        }
    }
}

/** A day a rule can land on. Every pattern parsed here is reachable, so scanning forward for a match always ends. */
sealed interface DayPattern {
    data class Weekday(val day: DayOfWeek) : DayPattern

    data class MonthDay(val day: Int) : DayPattern

    data object LastDay : DayPattern

    data class NthWeekday(val nth: Nth, val weekday: DayOfWeek, val month: Int?) : DayPattern

    data class Workday(val nth: Nth) : DayPattern

    data class Date(val month: Int, val day: Int) : DayPattern

    fun matches(date: LocalDate): Boolean {
        val last = date.lengthOfMonth()
        return when (this) {
            is Weekday -> {
                date.dayOfWeek == day
            }

            is MonthDay -> {
                date.dayOfMonth == minOf(day, last)
            }

            LastDay -> {
                date.dayOfMonth == last
            }

            is NthWeekday -> {
                date.dayOfWeek == weekday &&
                    (month == null || month == date.monthValue) &&
                    when (nth) {
                        is Nth.Ordinal -> (date.dayOfMonth - 1) / 7 + 1L == nth.n
                        Nth.Last -> date.dayOfMonth + 7 > last
                    }
            }

            is Workday -> {
                when (nth) {
                    is Nth.Ordinal -> isWorkday(date) && workdaysThrough(date).toLong() == nth.n
                    Nth.Last -> isLastWorkday(date)
                }
            }

            is Date -> {
                date.monthValue == month && date.dayOfMonth == day
            }
        }
    }

    fun sortKey(): Long =
        when (this) {
            is Weekday -> day.value - 1L
            is MonthDay -> day.toLong()
            else -> MAX_U32
        }

    fun text(): String =
        when (this) {
            is Weekday -> weekdayName(day)
            is MonthDay -> ordinal(day.toLong())
            LastDay -> "last day"
            is NthWeekday -> listOfNotNull("$nth", weekdayName(weekday), month?.let(::monthName)).joinToString(" ")
            is Workday -> "$nth workday"
            is Date -> "$day ${monthName(month)}"
        }

    companion object {
        fun parse(term: String): DayPattern? {
            val parts = words(term).filter { it != "of" }
            return when {
                parts == listOf("last", "day") -> {
                    LastDay
                }

                parts.size == 1 -> {
                    val word = parts[0]
                    weekday(word)?.let(::Weekday) ?: number(word)?.takeIf { it in 1..31 }?.let { MonthDay(it.toInt()) }
                }

                parts.size == 2 && parts[1] == "workday" -> {
                    Nth.parse(parts[0])?.takeIf { it.within(MAX_WORKDAYS_IN_MONTH) }?.let(::Workday)
                }

                parts.size == 2 -> {
                    nthWeekday(parts[0], parts[1], null) ?: date(parts[0], parts[1]) ?: date(parts[1], parts[0])
                }

                parts.size == 3 -> {
                    month(parts[2])?.let { nthWeekday(parts[0], parts[1], it) }
                }

                else -> {
                    null
                }
            }
        }

        private fun nthWeekday(nth: String, day: String, month: Int?): DayPattern? {
            val parsed = Nth.parse(nth)?.takeIf { it.within(MAX_WEEKDAY_ORDINAL) } ?: return null
            return weekday(day)?.let { NthWeekday(parsed, it, month) }
        }

        private fun date(name: String, day: String): DayPattern? {
            val month = month(name) ?: return null
            val value = number(day)?.takeIf { it in 1..31 }?.toInt() ?: return null
            return runCatching { LocalDate.of(LEAP_YEAR, month, value) }.getOrNull()?.let { Date(month, value) }
        }
    }
}
