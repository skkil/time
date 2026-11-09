use super::*;
use crate::projects;
use crate::testing::{db, env, missing_id, project};

#[test]
fn saves_overwrites_and_goes_with_the_project() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let website = project(conn, "Website")?;
        assert_eq!(get(conn, &website)?.updated_at, None);
        save(conn, &env, &website, "<p>First</p>")?;
        let canvas = save(conn, &env, &website, "<p>Second</p>")?;
        assert_eq!(canvas.content, "<p>Second</p>");
        assert!(canvas.updated_at.is_some());
        assert!(save(conn, &env, &missing_id(), "<p>x</p>").is_err());

        projects::delete(conn, &website)?;
        let left: i64 =
            conn.query_row("SELECT COUNT(*) FROM project_canvas", [], |row| row.get(0))?;
        assert_eq!(left, 0);
        Ok(())
    })
    .unwrap();
}
