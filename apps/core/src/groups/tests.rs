use rusqlite::params;

use super::*;
use crate::projects;
use crate::testing::{db, env, project};

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
