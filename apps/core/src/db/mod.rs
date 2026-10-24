mod migrate;
mod sync_ids;
mod uuid_ids;

#[cfg(test)]
mod tests;

use std::sync::Mutex;
use std::time::Duration;

use rusqlite::Connection;

pub use sync_ids::{DEVICE_KEYS, KEYED_TABLES};
pub use migrate::{UUID_IDS_VERSION, latest_version, migrate, migrate_to, schema_version};

use crate::error::Result;

const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

/// One SQLite connection behind a lock, migrated to the latest schema.
pub struct Db(Mutex<Connection>);

impl Db {
    pub fn new(mut conn: Connection) -> Result<Self> {
        conn.busy_timeout(BUSY_TIMEOUT)?;
        migrate(&mut conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn in_memory() -> Result<Self> {
        Self::new(Connection::open_in_memory()?)
    }

    pub fn call<T>(&self, run: impl FnOnce(&mut Connection) -> Result<T>) -> Result<T> {
        let mut conn = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        run(&mut conn)
    }
}
