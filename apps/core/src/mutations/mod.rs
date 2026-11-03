//! One generic entry point per direction: every write command applies as a
//! named mutation and every read answers by name, with arguments as a JSON
//! object keyed by the contract's parameter names. Names are the commands'
//! contract names (camelCase, as in `bindings.ts`).

mod apply;
mod args;
mod catalog;
mod query;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod vectors;

use rusqlite::Connection;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

pub use apply::apply;
pub use catalog::{DEVICE_ONLY, MUTATIONS, READS, SYNC_MUTATIONS};
pub use query::query;

use crate::env::MutationEnv;
use crate::error::{Error, Result};

pub fn is_mutation(name: &str) -> bool {
    MUTATIONS.contains(&name) || SYNC_MUTATIONS.contains(&name)
}

pub fn is_read(name: &str) -> bool {
    READS.contains(&name)
}

/// [`apply`] in its own transaction, committed only when it succeeds.
pub fn apply_in_transaction(
    conn: &mut Connection,
    env: &impl MutationEnv,
    name: &str,
    args: &Value,
) -> Result<Value> {
    let tx = conn.transaction()?;
    let result = apply(&tx, env, name, args)?;
    tx.commit()?;
    Ok(result)
}

/// Builds a mutation's arguments from typed values.
pub fn args(fields: impl Serialize) -> Result<Value> {
    serde_json::to_value(fields).map_err(|error| Error::invalid(error.to_string()))
}

/// Reads a mutation or query result back into its typed form.
pub fn result<T: DeserializeOwned>(value: Value) -> Result<T> {
    serde_json::from_value(value).map_err(|error| Error::Database(error.to_string()))
}
