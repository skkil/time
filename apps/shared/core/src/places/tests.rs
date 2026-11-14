use super::*;
use crate::tasks;
use crate::testing::{db, env, missing_id, task_input};

#[test]
fn names_are_unique_ignoring_case_and_required() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let home = create(conn, &env, "Home")?;
        let office = create(conn, &env, "Office")?;
        assert!(create(conn, &env, "home").is_err());
        assert!(create(conn, &env, &"x".repeat(81)).is_err());
        assert!(rename(conn, &home.id, "  ").is_err());
        assert!(rename(conn, &office.id, "HOME").is_err());
        assert_eq!(rename(conn, &home.id, "home")?.name, "home");
        let names: Vec<String> = list(conn)?.into_iter().map(|p| p.name).collect();
        assert_eq!(names, ["home", "Office"]);
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_task_takes_one_place_and_deleting_the_place_clears_it() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let library = create(conn, &env, "Library")?;
        let task = tasks::create(conn, &env, &task_input("Read", None))?;
        assert_eq!(task.place_id, None);
        let task = set_task_place(conn, &task.id, Some(&library.id))?;
        assert_eq!(task.place_id, Some(library.id.clone()));
        assert!(set_task_place(conn, &task.id, Some(&missing_id())).is_err());
        assert!(set_task_place(conn, &missing_id(), None).is_err());
        delete(conn, &library.id)?;
        assert_eq!(tasks::get(conn, &task.id)?.place_id, None);
        assert!(delete(conn, &library.id).is_err());
        Ok(())
    })
    .unwrap();
}
