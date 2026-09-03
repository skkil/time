use std::fmt;

use chrono::{Datelike, Days, Local, NaiveDate, TimeZone};
use rusqlite::types::{FromSql, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Serialize};
use specta::Type;

macro_rules! sql_newtype {
    ($name:ident($inner:ty)) => {
        impl ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
                self.0.to_sql()
            }
        }

        impl FromSql for $name {
            fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
                <$inner>::column_result(value).map(Self)
            }
        }
    };
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, Type,
)]
#[serde(transparent)]
pub struct Id(#[specta(type = specta_typescript::Number)] pub i64);
sql_newtype!(Id(i64));

impl fmt::Display for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
#[serde(transparent)]
pub struct Timestamp(#[specta(type = specta_typescript::Number)] pub i64);
sql_newtype!(Timestamp(i64));

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, Serialize, Deserialize, Type,
)]
#[serde(transparent)]
pub struct Seconds(#[specta(type = specta_typescript::Number)] pub i64);
sql_newtype!(Seconds(i64));

impl Timestamp {
    pub const DAY: i64 = 24 * 60 * 60;

    pub fn now() -> Self {
        Self(Local::now().timestamp())
    }

    pub fn seconds_until(self, later: Timestamp) -> i64 {
        later.0 - self.0
    }
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize, Type,
)]
#[serde(transparent)]
pub struct Date(#[specta(type = String)] pub NaiveDate);
sql_newtype!(Date(NaiveDate));

impl Date {
    pub fn today() -> Self {
        Self(Local::now().date_naive())
    }

    pub fn monday(self) -> Self {
        Self(self.0 - Days::new(u64::from(self.0.weekday().num_days_from_monday())))
    }

    pub fn add_days(self, days: i64) -> Self {
        Self(self.0 + chrono::Duration::days(days))
    }

    pub fn days_since(self, earlier: Date) -> i64 {
        (self.0 - earlier.0).num_days()
    }

    pub fn start(self) -> Timestamp {
        let midnight = self.0.and_hms_opt(0, 0, 0).expect("midnight exists");
        let local = Local
            .from_local_datetime(&midnight)
            .earliest()
            .unwrap_or_else(|| Local.from_utc_datetime(&midnight));
        Timestamp(local.timestamp())
    }
}

impl fmt::Display for Date {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.format("%Y-%m-%d").fmt(f)
    }
}

#[cfg(test)]
pub fn date(value: &str) -> Date {
    Date(NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap())
}
