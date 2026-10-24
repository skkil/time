use std::fmt;
use std::str::FromStr;

use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

use crate::error::{Error, Result};

/// A synced entity id: a UUID kept in its lowercase hyphenated form, so ids
/// made by UUIDv7 sort by creation time as plain text.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(transparent)]
pub struct Id(String);

impl Id {
    pub fn parse(text: &str) -> Result<Self> {
        Uuid::parse_str(text)
            .map(Self::from)
            .map_err(|_| Error::invalid(format!("“{text}” isn't an id.")))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<Uuid> for Id {
    fn from(uuid: Uuid) -> Self {
        Self(uuid.hyphenated().to_string())
    }
}

impl FromStr for Id {
    type Err = Error;

    fn from_str(text: &str) -> Result<Self> {
        Self::parse(text)
    }
}

impl fmt::Display for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl<'de> Deserialize<'de> for Id {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        let text = String::deserialize(deserializer)?;
        Self::parse(&text).map_err(serde::de::Error::custom)
    }
}

impl ToSql for Id {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        self.0.as_str().to_sql()
    }
}

impl FromSql for Id {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value {
            ValueRef::Text(text) => std::str::from_utf8(text)
                .map(|text| Self(text.to_owned()))
                .map_err(|error| FromSqlError::Other(Box::new(error))),
            _ => Err(FromSqlError::InvalidType),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_one_canonical_form() {
        let id = Id::parse("0192F0C1-7A2B-7C3D-8E4F-0123456789AB").unwrap();
        assert_eq!(id.as_str(), "0192f0c1-7a2b-7c3d-8e4f-0123456789ab");
        assert!(Id::parse("42").is_err());
        let parsed: Id = serde_json::from_str(&serde_json::to_string(&id).unwrap()).unwrap();
        assert_eq!(parsed, id);
        assert!(serde_json::from_str::<Id>("7").is_err());
    }
}
