use rusqlite::Connection;

use super::*;
use crate::error::Result;
use crate::testing::{db, env};

#[test]
fn orders_and_reorders_inbox_sections() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, None, "Backlog", None)?;
        let b = create(conn, &env, None, "Ideas", None)?;
        let c = create(conn, &env, None, "Now", Some(&a.id))?;
        let names = |conn: &Connection| -> Result<Vec<String>> {
            Ok(list(conn)?.into_iter().map(|s| s.name).collect())
        };
        assert_eq!(names(conn)?, ["Now", "Backlog", "Ideas"]);
        reorder(conn, &c.id, None)?;
        assert_eq!(names(conn)?, ["Backlog", "Ideas", "Now"]);
        reorder(conn, &b.id, Some(&a.id))?;
        assert_eq!(names(conn)?, ["Ideas", "Backlog", "Now"]);
        Ok(())
    })
    .unwrap();
}
