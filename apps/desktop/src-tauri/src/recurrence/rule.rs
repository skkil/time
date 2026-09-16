use std::fmt;

use chrono::{Days, Months, NaiveDate, Weekday};

use super::pattern::{DayPattern, first_weekday_from, is_workday, weekday};

const FORTNIGHT_DAYS: u64 = 14;
const WEEK_DAYS: u64 = 7;
const QUARTER_MONTHS: u32 = 3;
const MAX_INTERVAL: u32 = 365;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Rule {
    Days(u32),
    Weeks(u32),
    Months(u32),
    Years(u32),
    Workdays(u32),
    AlternateWeekday(Weekday),
    On(Vec<DayPattern>),
}

fn unit(word: &str, count: u32) -> Option<Rule> {
    match word.trim_end_matches('s') {
        "day" => Some(Rule::Days(count)),
        "week" => Some(Rule::Weeks(count)),
        "month" => Some(Rule::Months(count)),
        "quarter" => Some(Rule::Months(count * QUARTER_MONTHS)),
        "year" => Some(Rule::Years(count)),
        "workday" => Some(Rule::Workdays(count)),
        _ => None,
    }
}

fn next_workday(from: NaiveDate) -> NaiveDate {
    let mut next = from + Days::new(1);
    while !is_workday(next) {
        next = next + Days::new(1);
    }
    next
}

impl Rule {
    /// Reads what follows `every`, so `3 days`, `other fri` or `mon, 15th`.
    pub fn parse(body: &str) -> Option<Rule> {
        let words: Vec<&str> = body.split_whitespace().collect();
        match words.as_slice() {
            ["weekday"] => return Some(Rule::Workdays(1)),
            ["weekend"] => {
                return Some(Rule::On(vec![
                    DayPattern::Weekday(Weekday::Sat),
                    DayPattern::Weekday(Weekday::Sun),
                ]));
            }
            ["other", word] => {
                return unit(word, 2).or_else(|| weekday(word).map(Rule::AlternateWeekday));
            }
            [word] if unit(word, 1).is_some() => return unit(word, 1),
            [count, word] => {
                if let Ok(count) = count.parse::<u32>()
                    && let Some(rule) = unit(word, count)
                {
                    return (1..=MAX_INTERVAL).contains(&count).then_some(rule);
                }
            }
            _ => {}
        }
        Self::parse_days(body)
    }

    fn parse_days(body: &str) -> Option<Rule> {
        let listed = body.replace(" and ", ", ");
        let mut days = Vec::new();
        for term in listed.split(',').map(str::trim) {
            if term.is_empty() {
                continue;
            }
            match DayPattern::parse(term) {
                Some(pattern) => days.push(pattern),
                None => {
                    let spaced: Option<Vec<DayPattern>> =
                        term.split_whitespace().map(DayPattern::parse).collect();
                    days.extend(spaced.filter(|parts| {
                        parts
                            .iter()
                            .all(|part| matches!(part, DayPattern::Weekday(_)))
                    })?);
                }
            }
        }
        if days.is_empty() {
            return None;
        }
        days.sort_by_key(|day| day.sort_key());
        days.dedup();
        Some(Rule::On(days))
    }

    pub fn step(&self, from: NaiveDate) -> NaiveDate {
        match self {
            Rule::Days(n) => from + Days::new(u64::from(*n)),
            Rule::Weeks(n) => from + Days::new(WEEK_DAYS * u64::from(*n)),
            Rule::Months(n) => from + Months::new(*n),
            Rule::Years(n) => from + Months::new(12 * n),
            Rule::Workdays(n) => (0..*n).fold(from, |date, _| next_workday(date)),
            Rule::AlternateWeekday(day) => {
                first_weekday_from(from + Days::new(FORTNIGHT_DAYS), *day)
            }
            Rule::On(days) => {
                let mut next = from + Days::new(1);
                while !days.iter().any(|day| day.matches(next)) {
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

    /// The first date on or after `start` this rule lands on. With no chosen
    /// start, `every other fri` skips the next Friday, as Todoist does.
    pub fn first_date(&self, start: Option<NaiveDate>, today: NaiveDate) -> NaiveDate {
        let from = start.unwrap_or(today);
        match self {
            Rule::Workdays(_) if is_workday(from) => from,
            Rule::Workdays(_) => next_workday(from),
            Rule::AlternateWeekday(day) => {
                let first = first_weekday_from(from, *day);
                if start.is_some() {
                    first
                } else {
                    first_weekday_from(from + Days::new(1), *day) + Days::new(WEEK_DAYS)
                }
            }
            Rule::On(days) if days.iter().any(|day| day.matches(from)) => from,
            Rule::On(_) => self.step(from),
            _ => from,
        }
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
            Rule::Workdays(1) => write!(f, "every weekday"),
            Rule::Workdays(n) => write!(f, "every {n} workdays"),
            Rule::AlternateWeekday(day) => {
                write!(f, "every other {}", DayPattern::Weekday(*day))
            }
            Rule::On(days) => {
                let names: Vec<String> = days.iter().map(DayPattern::to_string).collect();
                write!(f, "every {}", names.join(", "))
            }
        }
    }
}
