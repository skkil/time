use std::fmt;

use chrono::{Datelike, Days, NaiveDate, Weekday};

const WEEKDAYS: [(Weekday, &str); 7] = [
    (Weekday::Mon, "mon"),
    (Weekday::Tue, "tue"),
    (Weekday::Wed, "wed"),
    (Weekday::Thu, "thu"),
    (Weekday::Fri, "fri"),
    (Weekday::Sat, "sat"),
    (Weekday::Sun, "sun"),
];

const WEEKDAY_NAMES: [&str; 7] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
];

const WEEKDAY_ALIASES: [(&str, Weekday); 3] = [
    ("tues", Weekday::Tue),
    ("thur", Weekday::Thu),
    ("thurs", Weekday::Thu),
];

const MONTHS: [&str; 12] = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

const MONTH_NAMES: [&str; 12] = [
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
];

const ORDINAL_WORDS: [&str; 5] = ["first", "second", "third", "fourth", "fifth"];
const MAX_WORKDAYS_IN_MONTH: u32 = 23;
const MAX_WEEKDAY_ORDINAL: u32 = 5;
const LEAP_YEAR: i32 = 2024;

pub fn weekday(word: &str) -> Option<Weekday> {
    WEEKDAYS
        .iter()
        .position(|(_, short)| word == *short)
        .or_else(|| WEEKDAY_NAMES.iter().position(|name| word == *name))
        .map(|index| WEEKDAYS[index].0)
        .or_else(|| {
            WEEKDAY_ALIASES
                .iter()
                .find(|(alias, _)| word == *alias)
                .map(|(_, day)| *day)
        })
}

fn weekday_name(day: Weekday) -> &'static str {
    WEEKDAYS[day.num_days_from_monday() as usize].1
}

fn month(word: &str) -> Option<u32> {
    let word = word.trim_end_matches('.');
    MONTHS
        .iter()
        .position(|name| word == *name)
        .or_else(|| MONTH_NAMES.iter().position(|name| word == *name))
        .or_else(|| (word == "sept").then_some(8))
        .map(|index| index as u32 + 1)
}

fn month_name(month: u32) -> &'static str {
    MONTHS[month as usize - 1]
}

fn number(word: &str) -> Option<u32> {
    let digits = word
        .strip_suffix("st")
        .or_else(|| word.strip_suffix("nd"))
        .or_else(|| word.strip_suffix("rd"))
        .or_else(|| word.strip_suffix("th"))
        .unwrap_or(word);
    digits.parse().ok()
}

fn ordinal(value: u32) -> String {
    let suffix = match (value % 10, value % 100) {
        (_, 11..=13) => "th",
        (1, _) => "st",
        (2, _) => "nd",
        (3, _) => "rd",
        _ => "th",
    };
    format!("{value}{suffix}")
}

pub fn is_workday(date: NaiveDate) -> bool {
    date.weekday().num_days_from_monday() < 5
}

fn days_in_month(date: NaiveDate) -> u32 {
    let (year, month) = (date.year(), date.month());
    let first_of_next = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    };
    first_of_next
        .and_then(|next| next.pred_opt())
        .map_or(28, |last| last.day())
}

fn workdays_through(date: NaiveDate) -> u32 {
    (1..=date.day())
        .filter_map(|day| date.with_day(day))
        .filter(|day| is_workday(*day))
        .count() as u32
}

fn is_last_workday(date: NaiveDate) -> bool {
    let last = days_in_month(date);
    is_workday(date)
        && (date.day() + 1..=last)
            .filter_map(|day| date.with_day(day))
            .all(|day| !is_workday(day))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Nth {
    Ordinal(u32),
    Last,
}

impl Nth {
    fn parse(word: &str) -> Option<Nth> {
        if word == "last" {
            return Some(Nth::Last);
        }
        ORDINAL_WORDS
            .iter()
            .position(|name| word == *name)
            .map(|index| index as u32 + 1)
            .or_else(|| number(word).filter(|_| word.ends_with(char::is_alphabetic)))
            .map(Nth::Ordinal)
    }

    fn within(self, limit: u32) -> bool {
        matches!(self, Nth::Last) || matches!(self, Nth::Ordinal(n) if (1..=limit).contains(&n))
    }
}

impl fmt::Display for Nth {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Nth::Ordinal(n) => f.write_str(&ordinal(*n)),
            Nth::Last => f.write_str("last"),
        }
    }
}

/// A day a rule can land on. Every pattern parsed here is reachable, so
/// scanning forward for a match always ends.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DayPattern {
    Weekday(Weekday),
    MonthDay(u32),
    LastDay,
    NthWeekday {
        nth: Nth,
        weekday: Weekday,
        month: Option<u32>,
    },
    Workday(Nth),
    Date {
        month: u32,
        day: u32,
    },
}

impl DayPattern {
    pub fn parse(term: &str) -> Option<DayPattern> {
        let words: Vec<&str> = term
            .split_whitespace()
            .filter(|word| *word != "of")
            .collect();
        match words.as_slice() {
            ["last", "day"] => Some(DayPattern::LastDay),
            [word] => weekday(word).map(DayPattern::Weekday).or_else(|| {
                number(word)
                    .filter(|day| (1..=31).contains(day))
                    .map(DayPattern::MonthDay)
            }),
            [nth, "workday"] => Nth::parse(nth)
                .filter(|nth| nth.within(MAX_WORKDAYS_IN_MONTH))
                .map(DayPattern::Workday),
            [first, second] => Self::nth_weekday(first, second, None)
                .or_else(|| Self::date(first, second))
                .or_else(|| Self::date(second, first)),
            [nth, day, name] => Self::nth_weekday(nth, day, Some(month(name)?)),
            _ => None,
        }
    }

    fn nth_weekday(nth: &str, day: &str, month: Option<u32>) -> Option<DayPattern> {
        Some(DayPattern::NthWeekday {
            nth: Nth::parse(nth).filter(|nth| nth.within(MAX_WEEKDAY_ORDINAL))?,
            weekday: weekday(day)?,
            month,
        })
    }

    fn date(name: &str, day: &str) -> Option<DayPattern> {
        let (month, day) = (month(name)?, number(day)?);
        NaiveDate::from_ymd_opt(LEAP_YEAR, month, day)?;
        Some(DayPattern::Date { month, day })
    }

    pub fn matches(self, date: NaiveDate) -> bool {
        let last = days_in_month(date);
        match self {
            DayPattern::Weekday(day) => date.weekday() == day,
            DayPattern::MonthDay(day) => date.day() == day.min(last),
            DayPattern::LastDay => date.day() == last,
            DayPattern::NthWeekday {
                nth,
                weekday,
                month,
            } => {
                date.weekday() == weekday
                    && month.is_none_or(|month| month == date.month())
                    && match nth {
                        Nth::Ordinal(n) => (date.day() - 1) / 7 + 1 == n,
                        Nth::Last => date.day() + 7 > last,
                    }
            }
            DayPattern::Workday(Nth::Ordinal(n)) => is_workday(date) && workdays_through(date) == n,
            DayPattern::Workday(Nth::Last) => is_last_workday(date),
            DayPattern::Date { month, day } => date.month() == month && date.day() == day,
        }
    }

    pub fn sort_key(self) -> u32 {
        match self {
            DayPattern::Weekday(day) => day.num_days_from_monday(),
            DayPattern::MonthDay(day) => day,
            _ => u32::MAX,
        }
    }
}

impl fmt::Display for DayPattern {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DayPattern::Weekday(day) => f.write_str(weekday_name(*day)),
            DayPattern::MonthDay(day) => f.write_str(&ordinal(*day)),
            DayPattern::LastDay => f.write_str("last day"),
            DayPattern::NthWeekday {
                nth,
                weekday,
                month: None,
            } => write!(f, "{nth} {}", weekday_name(*weekday)),
            DayPattern::NthWeekday {
                nth,
                weekday,
                month: Some(month),
            } => write!(f, "{nth} {} {}", weekday_name(*weekday), month_name(*month)),
            DayPattern::Workday(nth) => write!(f, "{nth} workday"),
            DayPattern::Date { month, day } => write!(f, "{day} {}", month_name(*month)),
        }
    }
}

pub fn first_weekday_from(date: NaiveDate, day: Weekday) -> NaiveDate {
    let offset = (7 + day.num_days_from_monday() - date.weekday().num_days_from_monday()) % 7;
    date + Days::new(u64::from(offset))
}
