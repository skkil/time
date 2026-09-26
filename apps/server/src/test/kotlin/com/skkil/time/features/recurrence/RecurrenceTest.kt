package com.skkil.time.features.recurrence

import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.readValue
import java.io.File
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class RecurrenceTest {
    private fun d(value: String) = LocalDate.parse(value)

    private fun rule(text: String) = Recurrence.parse(text)!!.rule

    private fun walk(text: String, from: String, count: Int): List<String> {
        val parsed = rule(text)
        var date = d(from)
        return (0 until count).map {
            date = parsed.step(date)
            date.toString()
        }
    }

    @Test
    fun `parses Todoist phrases`() {
        assertEquals(Rule.Days(1), rule("every day"))
        assertEquals(Rule.Days(1), rule("Daily"))
        assertEquals(Rule.Days(1), rule("everyday"))
        assertEquals(Rule.Days(3), rule("every 3 days"))
        assertEquals(Rule.Weeks(2), rule("every other week"))
        assertEquals(Rule.Workdays(1), rule("every weekday"))
        assertEquals(Rule.Workdays(1), rule("every workday"))
        assertEquals(Rule.Workdays(3), rule("every 3 workday"))
        assertEquals(Rule.Months(1), rule("every month"))
        assertEquals(Rule.Months(3), rule("every quarter"))
        assertEquals(Rule.Months(3), rule("quarterly"))
        assertEquals(rule("every mon"), rule("ev mon"))
        assertEquals(Rule.On(listOf(DayPattern.Weekday(DayOfWeek.TUESDAY))), rule("every tue at 16:30"))
        assertEquals(
            Rule.On(listOf(DayPattern.Weekday(DayOfWeek.MONDAY), DayPattern.Weekday(DayOfWeek.THURSDAY))),
            rule("every thursday and mon"),
        )
        assertEquals(rule("every mon, tue, wed, fri"), rule("every mon, tues, wed, and fri"))
        assertEquals(Rule.AlternateWeekday(DayOfWeek.FRIDAY), rule("every other fri"))
        assertEquals(rule("every 2nd, 15th, 27th"), rule("every 2, 15, 27"))
        assertEquals(Rule.On(listOf(DayPattern.LastDay)), rule("every last day"))
        assertEquals(
            Rule.On(listOf(DayPattern.NthWeekday(Nth.Ordinal(3), DayOfWeek.FRIDAY, null))),
            rule("every 3rd friday"),
        )
        assertEquals(rule("every 19 jul"), rule("every July 19"))
    }

    @Test
    fun `accepts every phrase Quick Add claims`() {
        val phrases: List<String> =
            JsonMapper().readValue(File("../shared/domain/src/quick-add/repeat-phrases.json"))
        for (phrase in phrases) assertNotNull(Recurrence.parse(phrase), phrase)
    }

    @Test
    fun `refuses what it cannot schedule`() {
        for (text in listOf(
            "tomorrow",
            "every monday every 1 hour",
            "every 3 hours",
            "every 6th friday",
            "every 24th workday",
            "every 32",
            "every feb 30",
            "every day ending someday",
        )) {
            assertNull(Recurrence.parse(text), text)
        }
    }

    @Test
    fun `round trips through text`() {
        for (text in listOf(
            "every day",
            "every other week",
            "every 3 months",
            "every weekday",
            "every 3 workdays",
            "every mon, thu",
            "every year",
            "every other fri",
            "every 2nd, 15th, 27th",
            "every last day",
            "every 3rd fri",
            "every last workday",
            "every 1st wed jan, 3rd thu jul",
            "every 14 jan, 15 sep",
            "every! 3 days",
            "every! week",
            "every day ending 2026-12-01",
        )) {
            assertEquals(text, Recurrence.parse(text).toString())
        }
    }

    @Test
    fun `advances past today`() {
        val today = d("2026-11-04")
        assertEquals(d("2026-11-05"), Rule.Days(1).nextAfter(d("2026-11-01"), today))
        assertEquals(d("2026-11-17"), Rule.Weeks(1).nextAfter(d("2026-11-10"), today))
        assertEquals(d("2026-11-10"), rule("every tue").nextAfter(d("2026-11-03"), today))
        assertEquals(d("2026-11-09"), Rule.Workdays(1).nextAfter(d("2026-11-06"), d("2026-11-06")))
        assertEquals(d("2026-02-28"), Rule.Months(1).nextAfter(d("2026-01-31"), d("2026-01-31")))
    }

    @Test
    fun `lands on month patterns`() {
        assertEquals(listOf("2026-11-20", "2026-12-18"), walk("every 3rd fri", "2026-11-01", 2))
        assertEquals(listOf("2026-11-27", "2026-12-25"), walk("every last fri", "2026-11-01", 2))
        assertEquals(listOf("2026-02-28", "2026-03-31"), walk("every last day", "2026-01-31", 2))
        assertEquals(listOf("2026-02-28", "2026-03-31"), walk("every 31", "2026-01-31", 2))
        assertEquals(
            listOf("2026-11-02", "2026-11-20", "2026-11-30"),
            walk("every 15th workday, first workday, last workday", "2026-11-01", 3),
        )
        assertEquals(listOf("2027-01-06", "2027-07-15"), walk("every 1st wed jan, 3rd thu jul", "2026-11-01", 2))
        assertEquals(listOf("2026-11-10", "2026-11-13"), walk("every 3 workdays", "2026-11-05", 2))
    }

    @Test
    fun `every other weekday skips the next one unless a start is chosen`() {
        val today = d("2026-11-04")
        val parsed = rule("every other fri")
        assertEquals(d("2026-11-13"), parsed.firstDate(null, today))
        assertEquals(d("2026-11-06"), parsed.firstDate(d("2026-11-06"), today))
        assertEquals(d("2026-11-27"), parsed.step(d("2026-11-13")))
    }

    @Test
    fun `first date lands on the rule`() {
        val today = d("2026-11-07")
        assertEquals(d("2026-11-09"), rule("every mon").firstDate(null, today))
        assertEquals(today, rule("every sat").firstDate(null, today))
        assertEquals(d("2026-11-09"), rule("every weekday").firstDate(null, today))
        assertEquals(today, rule("every day").firstDate(null, today))
        assertEquals(d("2027-01-03"), rule("every 2 weeks").firstDate(d("2027-01-03"), today))
    }

    @Test
    fun `completion based repeats count from today`() {
        val every = Recurrence.parse("every 3 months")!!
        val after = Recurrence.parse("every! 3 months")!!
        val due = d("2026-01-10")
        val today = d("2026-01-20")
        assertEquals(d("2026-04-10"), every.nextAfter(due, today))
        assertEquals(d("2026-04-20"), after.nextAfter(due, today))
        assertEquals(Recurrence.parse("every! 10 days"), Recurrence.parse("after 10 days"))
    }

    @Test
    fun `stops after its end date inclusive`() {
        val repeat = Recurrence.parse("every day ending 2026-11-10")!!
        assertEquals(d("2026-11-10"), repeat.nextAfter(d("2026-11-09"), d("2026-11-09")))
        assertNull(repeat.nextAfter(d("2026-11-10"), d("2026-11-10")))
        assertNull(repeat.following(d("2026-11-10")))
    }
}
