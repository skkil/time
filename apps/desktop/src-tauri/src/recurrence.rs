use std::fmt;

use chrono::{Datelike, Days, Months, NaiveDate, Weekday};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Rule {
    Days(u32),
    Weeks(u32),
    Weekdays,
    On(Vec<Weekday>),
    Months(u32),
    Years(u32),
}

const WEEKDAYS: [(Weekday, &str, &str); 7] = [
    (Weekday::Mon, "mon", "monday"),
    (Weekday::Tue, "tue", "tuesday"),
    (Weekday::Wed, "wed", "wednesday"),
    (Weekday::Thu, "thu", "thursday"),
    (Weekday::Fri, "fri", "friday"),
    (Weekday::Sat, "sat", "saturday"),
    (Weekday::Sun, "sun", "sunday"),
];

fn weekday(word: &str) -> Option<Weekday> {
    WEEKDAYS
        .iter()
        .find(|(_, short, long)| word == *short || word == *long)
        .map(|(day, _, _)| *day)
}

fn unit(word: &str, count: u32) -> Option<Rule> {
    match word.trim_end_matches('s') {
        "day" => Some(Rule::Days(count)),
        "week" => Some(Rule::Weeks(count)),
        "month" => Some(Rule::Months(count)),
        "year" => Some(Rule::Years(count)),
        _ => None,
    }
}

impl Rule {
    pub fn parse(text: &str) -> Option<Rule> {
        let text = text.trim().to_lowercase();
        let text = text
            .split(" at ")
            .next()
            .unwrap_or_default()
            .split(" starting")
            .next()
            .unwrap_or_default()
            .trim();
        match text {
            "daily" => return Some(Rule::Days(1)),
            "weekly" => return Some(Rule::Weeks(1)),
            "monthly" => return Some(Rule::Months(1)),
            "yearly" | "annually" => return Some(Rule::Years(1)),
            _ => {}
        }
        let rest = text.strip_prefix("every ")?.trim();
        if matches!(rest, "weekday" | "workday") {
            return Some(Rule::Weekdays);
        }
        let words: Vec<&str> = rest.split_whitespace().collect();
        match words.as_slice() {
            [word] if unit(word, 1).is_some() => return unit(word, 1),
            ["other", word] => return unit(word, 2),
            [count, word] => {
                if let Ok(count) = count.parse::<u32>()
                    && (1..=365).contains(&count)
                {
                    return unit(word, count);
                }
            }
            _ => {}
        }
        let mut days: Vec<Weekday> = rest
            .split([',', ' '])
            .filter(|word| !word.is_empty() && *word != "and")
            .map(weekday)
            .collect::<Option<_>>()?;
        if days.is_empty() {
            return None;
        }
        days.sort_by_key(|day| day.num_days_from_monday());
        days.dedup();
        Some(Rule::On(days))
    }

    fn step(&self, from: NaiveDate) -> NaiveDate {
        match self {
            Rule::Days(n) => from + Days::new(u64::from(*n)),
            Rule::Weeks(n) => from + Days::new(7 * u64::from(*n)),
            Rule::Months(n) => from + Months::new(*n),
            Rule::Years(n) => from + Months::new(12 * n),
            Rule::Weekdays => {
                let mut next = from + Days::new(1);
                while next.weekday().num_days_from_monday() >= 5 {
                    next = next + Days::new(1);
                }
                next
            }
            Rule::On(days) => {
                let mut next = from + Days::new(1);
                while !days.contains(&next.weekday()) {
                    next = next + Days::new(1);
                }
                next
            }
        }
    }

    pub fn next_after(&self, due: NaiveDate, today: NaiveDate) -> NaiveDate {
        let mut next = self.step(due);
        while next <= today {
            next = self.step(next);
        }
        next
    }
}

fn plural(f: &mut fmt::Formatter<'_>, count: u32, unit: &str) -> fmt::Result {
    match count {
        1 => write!(f, "every {unit}"),
        2 => write!(f, "every other {unit}"),
        n => write!(f, "every {n} {unit}s"),
    }
}

impl fmt::Display for Rule {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Rule::Days(n) => plural(f, *n, "day"),
            Rule::Weeks(n) => plural(f, *n, "week"),
            Rule::Months(n) => plural(f, *n, "month"),
            Rule::Years(n) => plural(f, *n, "year"),
            Rule::Weekdays => write!(f, "every weekday"),
            Rule::On(days) => {
                let names: Vec<&str> = days
                    .iter()
                    .filter_map(|day| WEEKDAYS.iter().find(|(d, _, _)| d == day))
                    .map(|(_, short, _)| *short)
                    .collect();
                write!(f, "every {}", names.join(", "))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn parses_todoist_phrases() {
        assert_eq!(Rule::parse("every day"), Some(Rule::Days(1)));
        assert_eq!(Rule::parse("Daily"), Some(Rule::Days(1)));
        assert_eq!(Rule::parse("every 3 days"), Some(Rule::Days(3)));
        assert_eq!(Rule::parse("every other week"), Some(Rule::Weeks(2)));
        assert_eq!(Rule::parse("every weekday"), Some(Rule::Weekdays));
        assert_eq!(
            Rule::parse("every tue at 16:30"),
            Some(Rule::On(vec![Weekday::Tue]))
        );
        assert_eq!(
            Rule::parse("every thursday and mon"),
            Some(Rule::On(vec![Weekday::Mon, Weekday::Thu]))
        );
        assert_eq!(Rule::parse("every month"), Some(Rule::Months(1)));
        assert_eq!(Rule::parse("every 2nd friday"), None);
        assert_eq!(Rule::parse("tomorrow"), None);
    }

    #[test]
    fn round_trips_through_text() {
        for text in [
            "every day",
            "every other week",
            "every 3 months",
            "every weekday",
            "every mon, thu",
            "every year",
        ] {
            assert_eq!(Rule::parse(text).unwrap().to_string(), text);
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
            Rule::On(vec![Weekday::Tue]).next_after(d("2026-11-03"), today),
            d("2026-11-10")
        );
        assert_eq!(
            Rule::Weekdays.next_after(d("2026-11-06"), d("2026-11-06")),
            d("2026-11-09")
        );
        assert_eq!(
            Rule::Months(1).next_after(d("2026-01-31"), d("2026-01-31")),
            d("2026-02-28")
        );
    }
}
