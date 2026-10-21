mod pattern;
mod rule;

use std::fmt;

use chrono::NaiveDate;

pub use rule::Rule;

const EVERY: &str = "every";
const FROM_COMPLETION: &str = "every!";
const ISO_DATE: &str = "%Y-%m-%d";

/// A repeat as stored on a task: its rule, whether the next date counts from
/// completion (`every!`) instead of the due date, and an inclusive last date.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Recurrence {
    rule: Rule,
    from_completion: bool,
    ends: Option<NaiveDate>,
}

fn body_of(text: &str) -> Option<(&str, bool)> {
    match text {
        "daily" | "everyday" => return Some(("day", false)),
        "weekly" => return Some(("week", false)),
        "monthly" => return Some(("month", false)),
        "quarterly" => return Some(("quarter", false)),
        "yearly" | "annually" => return Some(("year", false)),
        _ => {}
    }
    for (prefix, from_completion) in [
        ("every!", true),
        ("ev!", true),
        ("after", true),
        ("every", false),
        ("ev", false),
    ] {
        if let Some(body) = text.strip_prefix(prefix)
            && body.starts_with(' ')
        {
            return Some((body.trim(), from_completion));
        }
    }
    None
}

fn cut_at<'a>(text: &'a str, marker: &str) -> &'a str {
    text.split(marker).next().unwrap_or_default()
}

impl Recurrence {
    pub fn parse(text: &str) -> Option<Recurrence> {
        let text = text.trim().to_lowercase();
        let ends = match text.split(" ending ").nth(1) {
            Some(date) => {
                let date = date.split_whitespace().next()?;
                Some(NaiveDate::parse_from_str(date, ISO_DATE).ok()?)
            }
            None => None,
        };
        let text = cut_at(cut_at(cut_at(&text, " ending "), " at "), " starting").trim();
        let (body, from_completion) = body_of(text)?;
        Some(Recurrence {
            rule: Rule::parse(body)?,
            from_completion,
            ends,
        })
    }

    fn within_end(&self, date: NaiveDate) -> Option<NaiveDate> {
        self.ends.is_none_or(|end| date <= end).then_some(date)
    }

    /// The date after finishing, or `None` once the repeat has run out.
    pub fn next_after(&self, due: NaiveDate, today: NaiveDate) -> Option<NaiveDate> {
        let base = if self.from_completion { today } else { due };
        self.within_end(self.rule.next_after(base, today))
    }

    pub fn following(&self, date: NaiveDate) -> Option<NaiveDate> {
        self.within_end(self.rule.step(date))
    }

    pub fn first_date(&self, start: Option<NaiveDate>, today: NaiveDate) -> NaiveDate {
        self.rule.first_date(start, today)
    }
}

impl fmt::Display for Recurrence {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let rule = self.rule.to_string();
        match self.from_completion {
            true => write!(f, "{FROM_COMPLETION}{}", &rule[EVERY.len()..])?,
            false => f.write_str(&rule)?,
        }
        if let Some(end) = self.ends {
            write!(f, " ending {}", end.format(ISO_DATE))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }

    use chrono::Weekday;

    use super::pattern::{DayPattern, Nth};

    fn rule(text: &str) -> Rule {
        Recurrence::parse(text).unwrap().rule
    }

    fn walk(text: &str, from: &str, count: usize) -> Vec<String> {
        let parsed = rule(text);
        let mut date = d(from);
        (0..count)
            .map(|_| {
                date = parsed.step(date);
                date.to_string()
            })
            .collect()
    }

    #[test]
    fn parses_todoist_phrases() {
        assert_eq!(rule("every day"), Rule::Days(1));
        assert_eq!(rule("Daily"), Rule::Days(1));
        assert_eq!(rule("everyday"), Rule::Days(1));
        assert_eq!(rule("every 3 days"), Rule::Days(3));
        assert_eq!(rule("every other week"), Rule::Weeks(2));
        assert_eq!(rule("every weekday"), Rule::Workdays(1));
        assert_eq!(rule("every workday"), Rule::Workdays(1));
        assert_eq!(rule("every 3 workday"), Rule::Workdays(3));
        assert_eq!(rule("every month"), Rule::Months(1));
        assert_eq!(rule("every quarter"), Rule::Months(3));
        assert_eq!(rule("quarterly"), Rule::Months(3));
        assert_eq!(rule("ev mon"), rule("every mon"));
        assert_eq!(
            rule("every tue at 16:30"),
            Rule::On(vec![DayPattern::Weekday(Weekday::Tue)])
        );
        assert_eq!(
            rule("every thursday and mon"),
            Rule::On(vec![
                DayPattern::Weekday(Weekday::Mon),
                DayPattern::Weekday(Weekday::Thu)
            ])
        );
        assert_eq!(
            rule("every mon, tues, wed, and fri"),
            rule("every mon, tue, wed, fri")
        );
        assert_eq!(
            rule("every other fri"),
            Rule::AlternateWeekday(Weekday::Fri)
        );
        assert_eq!(rule("every 2, 15, 27"), rule("every 2nd, 15th, 27th"));
        assert_eq!(rule("every last day"), Rule::On(vec![DayPattern::LastDay]));
        assert_eq!(
            rule("every 3rd friday"),
            Rule::On(vec![DayPattern::NthWeekday {
                nth: Nth::Ordinal(3),
                weekday: Weekday::Fri,
                month: None
            }])
        );
        assert_eq!(rule("every July 19"), rule("every 19 jul"));
    }

    #[test]
    fn accepts_every_phrase_quick_add_claims() {
        let phrases: Vec<String> = serde_json::from_str(include_str!(
            "../../../shared/domain/src/quick-add/repeat-phrases.json"
        ))
        .unwrap();
        for phrase in phrases {
            assert!(Recurrence::parse(&phrase).is_some(), "{phrase}");
        }
    }

    #[test]
    fn refuses_what_it_cannot_schedule() {
        for text in [
            "tomorrow",
            "every monday every 1 hour",
            "every 3 hours",
            "every 6th friday",
            "every 24th workday",
            "every 32",
            "every feb 30",
            "every day ending someday",
        ] {
            assert_eq!(Recurrence::parse(text), None, "{text}");
        }
    }

    #[test]
    fn round_trips_through_text() {
        for text in [
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
        ] {
            assert_eq!(Recurrence::parse(text).unwrap().to_string(), text);
        }
    }

    #[test]
    fn advances_past_today() {
        let today = d("2026-11-04");
        assert_eq!(
            Rule::Days(1).next_after(d("2026-11-01"), today),
            d("2026-11-05")
        );
        assert_eq!(
            Rule::Weeks(1).next_after(d("2026-11-10"), today),
            d("2026-11-17")
        );
        assert_eq!(
            rule("every tue").next_after(d("2026-11-03"), today),
            d("2026-11-10")
        );
        assert_eq!(
            Rule::Workdays(1).next_after(d("2026-11-06"), d("2026-11-06")),
            d("2026-11-09")
        );
        assert_eq!(
            Rule::Months(1).next_after(d("2026-01-31"), d("2026-01-31")),
            d("2026-02-28")
        );
    }

    #[test]
    fn lands_on_month_patterns() {
        assert_eq!(
            walk("every 3rd fri", "2026-11-01", 2),
            ["2026-11-20", "2026-12-18"]
        );
        assert_eq!(
            walk("every last fri", "2026-11-01", 2),
            ["2026-11-27", "2026-12-25"]
        );
        assert_eq!(
            walk("every last day", "2026-01-31", 2),
            ["2026-02-28", "2026-03-31"]
        );
        assert_eq!(
            walk("every 31", "2026-01-31", 2),
            ["2026-02-28", "2026-03-31"]
        );
        assert_eq!(
            walk(
                "every 15th workday, first workday, last workday",
                "2026-11-01",
                3
            ),
            ["2026-11-02", "2026-11-20", "2026-11-30"]
        );
        assert_eq!(
            walk("every 1st wed jan, 3rd thu jul", "2026-11-01", 2),
            ["2027-01-06", "2027-07-15"]
        );
        assert_eq!(
            walk("every 3 workdays", "2026-11-05", 2),
            ["2026-11-10", "2026-11-13"]
        );
    }

    #[test]
    fn every_other_weekday_skips_the_next_one_unless_a_start_is_chosen() {
        let today = d("2026-11-04");
        let parsed = rule("every other fri");
        assert_eq!(parsed.first_date(None, today), d("2026-11-13"));
        assert_eq!(
            parsed.first_date(Some(d("2026-11-06")), today),
            d("2026-11-06")
        );
        assert_eq!(parsed.step(d("2026-11-13")), d("2026-11-27"));
    }

    #[test]
    fn first_date_lands_on_the_rule() {
        let today = d("2026-11-07");
        assert_eq!(rule("every mon").first_date(None, today), d("2026-11-09"));
        assert_eq!(rule("every sat").first_date(None, today), today);
        assert_eq!(
            rule("every weekday").first_date(None, today),
            d("2026-11-09")
        );
        assert_eq!(rule("every day").first_date(None, today), today);
        assert_eq!(
            rule("every 2 weeks").first_date(Some(d("2027-01-03")), today),
            d("2027-01-03")
        );
    }

    #[test]
    fn completion_based_repeats_count_from_today() {
        let every = Recurrence::parse("every 3 months").unwrap();
        let after = Recurrence::parse("every! 3 months").unwrap();
        let (due, today) = (d("2026-01-10"), d("2026-01-20"));
        assert_eq!(every.next_after(due, today), Some(d("2026-04-10")));
        assert_eq!(after.next_after(due, today), Some(d("2026-04-20")));
        assert_eq!(
            Recurrence::parse("after 10 days"),
            Recurrence::parse("every! 10 days")
        );
    }

    #[test]
    fn stops_after_its_end_date_inclusive() {
        let repeat = Recurrence::parse("every day ending 2026-11-10").unwrap();
        assert_eq!(
            repeat.next_after(d("2026-11-09"), d("2026-11-09")),
            Some(d("2026-11-10"))
        );
        assert_eq!(repeat.next_after(d("2026-11-10"), d("2026-11-10")), None);
        assert_eq!(repeat.following(d("2026-11-10")), None);
    }
}
