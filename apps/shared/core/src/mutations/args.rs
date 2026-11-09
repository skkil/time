use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};

use super::booleans;
use crate::error::{Error, Result};
use crate::types::Id;

/// A command's arguments: a JSON object keyed by the contract's parameter
/// names. A missing key reads as `null`, so optional parameters may be left
/// out, and a boolean may also be `1`/`0`.
pub struct Args<'a>(Option<&'a Map<String, Value>>);

impl<'a> Args<'a> {
    pub fn new(args: &'a Value) -> Result<Self> {
        match args {
            Value::Object(fields) => Ok(Self(Some(fields))),
            Value::Null => Ok(Self(None)),
            _ => Err(Error::invalid("Arguments must be an object.")),
        }
    }

    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Result<T> {
        let value = self
            .0
            .and_then(|fields| fields.get(key))
            .cloned()
            .unwrap_or(Value::Null);
        booleans::from_value(value)
            .map_err(|error| Error::invalid(format!("Argument `{key}`: {error}")))
    }

    pub fn id(&self, key: &str) -> Result<Id> {
        self.get(key)
    }

    pub fn opt_id(&self, key: &str) -> Result<Option<Id>> {
        self.get(key)
    }

    pub fn text(&self, key: &str) -> Result<String> {
        self.get(key)
    }
}

pub fn out(value: impl Serialize) -> Result<Value> {
    serde_json::to_value(value).map_err(|error| Error::Database(error.to_string()))
}
