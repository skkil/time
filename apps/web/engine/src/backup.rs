use serde_json::json;
use time_core::data::{self, LocalData};
use time_core::sync::Engine;
use time_core::{Error, Result};

/// Every synced row as pretty JSON, the browser's backup file.
pub fn export(engine: &Engine) -> Result<String> {
    let dump = data::dump(engine.connection())?;
    serde_json::to_string_pretty(&dump).map_err(|error| Error::Database(error.to_string()))
}

/// Writes a backup back as one `importLocal` mutation, so it reaches the
/// account like any other change. Rows with a natural key take this
/// account's ids for it; rows the backup doesn't have are kept. Returns how
/// many rows it wrote.
pub fn restore(engine: &mut Engine, text: &str) -> Result<usize> {
    let backup: LocalData = serde_json::from_str(text)
        .map_err(|_| Error::invalid("This file isn't a skkil time backup."))?;
    let backup = match engine.scope()? {
        Some(scope) => backup.with_seed_ids(scope),
        None => backup,
    };
    if backup.is_empty() {
        return Ok(0);
    }
    engine.mutate("importLocal", &json!({ "data": backup }))?;
    Ok(backup.rows())
}
