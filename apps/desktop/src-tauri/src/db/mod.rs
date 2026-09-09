use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::{Error, Result};

const MIGRATIONS: &[&str] = &[
    include_str!("migrations/001_init.sql"),
    include_str!("migrations/002_planner.sql"),
    include_str!("migrations/003_tasks.sql"),
    include_str!("migrations/004_habits.sql"),
    include_str!("migrations/005_review.sql"),
    include_str!("migrations/006_rituals.sql"),
    include_str!("migrations/007_project_model.sql"),
    include_str!("migrations/008_running_timer.sql"),
];

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        let mut conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        migrate(&mut conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    #[cfg(test)]
    pub fn in_memory() -> Self {
        let mut conn = Connection::open_in_memory().expect("in-memory database");
        migrate(&mut conn).expect("migrations apply");
        Self(Mutex::new(conn))
    }

    pub fn call<T>(&self, run: impl FnOnce(&mut Connection) -> Result<T>) -> Result<T> {
        let mut conn = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        run(&mut conn)
    }
}

fn migrate(conn: &mut Connection) -> Result<()> {
    conn.pragma_update(None, "foreign_keys", false)?;
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    for (index, sql) in MIGRATIONS.iter().enumerate().skip(version as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_m0_data_forward() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.execute_batch(
            "PRAGMA user_version = 1;
             INSERT INTO project (name) VALUES ('Thesis');
             INSERT INTO focus (project_id, started_at, ended_at, note) VALUES (1, 100, 700, 'draft');
             INSERT INTO day (date, felt, plan_morning) VALUES ('2026-11-02', 4, 'write');",
        )
        .unwrap();

        migrate(&mut conn).unwrap();

        let entry: (String, i64, i64) = conn
            .query_row(
                "SELECT description, project_id, ended_at - started_at FROM time_entry",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(entry, ("draft".into(), 1, 600));

        let project: (String, Option<i64>) = conn
            .query_row("SELECT name, parent_id FROM project", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert_eq!(project, ("Thesis".into(), None));

        let felt: i64 = conn
            .query_row("SELECT felt FROM day", [], |row| row.get(0))
            .unwrap();
        assert_eq!(felt, 4);
    }
}
