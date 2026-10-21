mod id;
mod time;

pub use id::Id;
pub use time::{Date, Seconds, Timestamp};

#[cfg(test)]
pub fn date(value: &str) -> Date {
    Date(chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap())
}
