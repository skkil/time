use rusqlite::Connection;

use super::{sync_ids, uuid_ids};
use crate::error::{Error, Result};

enum Migration {
    Sql(&'static str),
    Code(fn(&Connection) -> Result<()>),
}

const MIGRATIONS: &[Migration] = &[
    Migration::Sql(include_str!("migrations/001_init.sql")),
    Migration::Sql(include_str!("migrations/002_planner.sql")),
    Migration::Sql(include_str!("migrations/003_tasks.sql")),
    Migration::Sql(include_str!("migrations/004_habits.sql")),
    Migration::Sql(include_str!("migrations/005_review.sql")),
    Migration::Sql(include_str!("migrations/006_rituals.sql")),
    Migration::Sql(include_str!("migrations/007_project_model.sql")),
    Migration::Sql(include_str!("migrations/008_running_timer.sql")),
    Migration::Sql(include_str!("migrations/009_organizations.sql")),
    Migration::Sql(include_str!("migrations/010_task_dependency.sql")),
    Migration::Sql(include_str!("migrations/011_records.sql")),
    Migration::Sql(include_str!("migrations/012_groups.sql")),
    Migration::Sql(include_str!("migrations/013_project_canvas.sql")),
    Migration::Sql(include_str!("migrations/014_task_reminder.sql")),
    Migration::Sql(include_str!("migrations/015_checkout_steps.sql")),
    Migration::Sql(include_str!("migrations/016_timer_pause.sql")),
    Migration::Code(uuid_ids::migrate),
    Migration::Sql(include_str!("migrations/018_creation_order.sql")),
    Migration::Code(sync_ids::migrate),
    Migration::Sql(include_str!("migrations/020_review_position.sql")),
    Migration::Sql(include_str!("migrations/021_due_window.sql")),
    Migration::Sql(include_str!("migrations/022_block_logging.sql")),
];

/// The schema version that switched every id to a UUID.
pub const UUID_IDS_VERSION: usize = 17;

pub fn latest_version() -> usize {
    MIGRATIONS.len()
}

pub fn schema_version(conn: &Connection) -> Result<usize> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    Ok(version as usize)
}

/// Applies every migration after the database's `user_version`, each in its
/// own transaction with foreign keys off, refusing one that leaves dangling
/// references.
pub fn migrate(conn: &mut Connection) -> Result<()> {
    migrate_to(conn, latest_version())
}

/// Applies migrations up to schema version `target` only; for tests and tools
/// that need a database as an older release left it.
pub fn migrate_to(conn: &mut Connection, target: usize) -> Result<()> {
    conn.pragma_update(None, "foreign_keys", false)?;
    let version = schema_version(conn)?;

    for (index, migration) in MIGRATIONS.iter().enumerate().take(target).skip(version) {
        let tx = conn.transaction()?;
        match migration {
            Migration::Sql(sql) => tx.execute_batch(sql)?,
            Migration::Code(run) => run(&tx)?,
        }
        let violations: i64 =
            tx.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| {
                row.get(0)
            })?;
        if violations > 0 {
            return Err(Error::Database(format!(
                "Migration {} left {violations} foreign key violations",
                index + 1
            )));
        }
        tx.pragma_update(None, "user_version", index as i64 + 1)?;
        tx.commit()?;
    }

    conn.pragma_update(None, "foreign_keys", true)?;
    Ok(())
}
