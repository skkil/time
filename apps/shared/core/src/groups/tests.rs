use rusqlite::params;

use super::*;
use crate::projects;
use crate::testing::{db, env, project};

#[test]
fn reorders_groups() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, "A")?;
        create(conn, &env, "B")?;
        let c = create(conn, &env, "C")?;
        let names = |conn: &rusqlite::Connection| -> crate::error::Result<Vec<String>> {
            Ok(list(conn)?.into_iter().map(|g| g.name).collect())
        };
        reorder(conn, &c.id, Some(&a.id))?;
        assert_eq!(names(conn)?, ["C", "A", "B"]);
        reorder(conn, &c.id, None)?;
        assert_eq!(names(conn)?, ["A", "B", "C"]);
        Ok(())
    })
    .unwrap();
}

#[test]
fn names_are_unique_and_deleting_frees_projects() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let acme = create(conn, &env, "Acme")?;
        assert!(create(conn, &env, "acme").is_err());
        assert!(rename(conn, &acme.id, "  ").is_err());
        let website = project(conn, "Website")?;
        conn.execute(
            "UPDATE project SET group_id = ?1 WHERE id = ?2",
            params![acme.id, website],
        )?;
        delete(conn, &acme.id)?;
        assert_eq!(projects::get(conn, &website)?.group_id, None);
        Ok(())
    })
    .unwrap();
}
