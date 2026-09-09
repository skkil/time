use tauri::State;

use super::time_entries::Timer;
use crate::db::{self, Db};
use crate::error::Result;

#[tauri::command]
#[specta::specta]
pub async fn delete_all_data(db: State<'_, Db>, timer: State<'_, Timer>) -> Result<()> {
    timer.with(|running| *running = None);
    db.call(db::reset)
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    fn count(conn: &Connection, table: &str) -> Result<i64> {
        Ok(
            conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })?,
        )
    }

    #[test]
    fn reset_empties_data_and_restores_defaults() {
        let db = Db::in_memory();
        db.call(|conn| {
            let rituals = count(conn, "ritual")?;
            conn.execute_batch(
                "INSERT INTO project (name) VALUES ('Thesis');
                 DELETE FROM ritual;",
            )?;

            db::reset(conn)?;

            assert_eq!(count(conn, "project")?, 0);
            assert_eq!(count(conn, "ritual")?, rituals);
            assert!(rituals > 0);
            Ok(())
        })
        .unwrap();
    }
}
