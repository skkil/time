use std::collections::HashMap;

use chrono::{Datelike, Days};

use super::model::{CONSISTENCY_DAYS, DayStatus, Habit, Log};
use crate::types::Date;

fn scheduled(habit: &Habit, date: Date) -> bool {
    habit.days & (1 << date.0.weekday().num_days_from_monday()) != 0
}

/// A day's status, derived from the habit and its log; never stored. A
/// status the user set always wins over a measured value.
pub fn status(habit: &Habit, date: Date, today: Date, log: Option<&Log>) -> DayStatus {
    if date > today || date < habit.start_date {
        return DayStatus::Off;
    }
    match log.and_then(|log| log.status.as_deref()) {
        Some("done") => return DayStatus::Done,
        Some("failed") => return DayStatus::Failed,
        Some("skipped") => return DayStatus::Skipped,
        _ => {}
    }
    if !scheduled(habit, date) {
        return DayStatus::Off;
    }
    let value = log.map_or(0.0, |log| log.value);
    let past = date < today;
    if habit.kind == "build" {
        if value >= habit.goal {
            DayStatus::Done
        } else if past {
            DayStatus::Missed
        } else {
            DayStatus::Pending
        }
    } else if value > habit.goal {
        DayStatus::Failed
    } else if past {
        DayStatus::Done
    } else {
        DayStatus::Pending
    }
}

/// Fills in "done x of the last 14 due days" (with planned skip days
/// forgiven each week) and, for quit and limit habits, the clean streak start.
pub fn with_stats(mut habit: Habit, logs: &HashMap<Date, Log>, today: Date) -> Habit {
    let mut forgiven: HashMap<Date, i32> = HashMap::new();
    let (mut done_days, mut due_days) = (0, 0);
    let mut date = today.add_days(1 - CONSISTENCY_DAYS).max(habit.start_date);
    while date <= today {
        match status(&habit, date, today, logs.get(&date)) {
            DayStatus::Done => {
                done_days += 1;
                due_days += 1;
            }
            DayStatus::Failed => due_days += 1,
            DayStatus::Missed => {
                let used = forgiven.entry(date.monday()).or_default();
                if *used < habit.skip_days {
                    *used += 1;
                } else {
                    due_days += 1;
                }
            }
            _ => {}
        }
        date = date.add_days(1);
    }
    let mut last_failure: Option<Date> = None;
    let mut date = today;
    while date >= habit.start_date && habit.kind != "build" {
        if status(&habit, date, today, logs.get(&date)) == DayStatus::Failed {
            last_failure = Some(date);
            break;
        }
        date = Date(date.0 - Days::new(1));
    }
    habit.done_days = done_days;
    habit.due_days = due_days;
    habit.clean_since = (habit.kind != "build")
        .then(|| last_failure.map_or(habit.start_date, |day| Date(day.0 + Days::new(1))));
    habit
}
