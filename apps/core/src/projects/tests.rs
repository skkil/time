use super::*;
use crate::error::Error;
use crate::groups;
use crate::testing::{db, env, missing_id, project_input as input};
use crate::types::Id;

fn settings(group_id: Option<&Id>, status: &str) -> ProjectSettings {
    ProjectSettings {
        group_id: group_id.cloned(),
        status: status.into(),
        outcome: String::new(),
        weekly_minutes: Some(360),
        target_date: None,
        kill_criteria: String::new(),
        review_every_weeks: 1,
        in_order: false,
    }
}

#[test]
fn nests_up_to_three_levels() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, &input("School", None))?;
        let b = create(conn, &env, &input("Algorithms", Some(&a.id)))?;
        let c = create(conn, &env, &input("Homework", Some(&b.id)))?;
        assert!(matches!(
            create(conn, &env, &input("Too deep", Some(&c.id))),
            Err(Error::Invalid(_))
        ));
        Ok(())
    })
    .unwrap();
}

#[test]
fn refuses_cycles_and_deep_moves() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, &input("A", None))?;
        let b = create(conn, &env, &input("B", Some(&a.id)))?;
        let other = create(conn, &env, &input("Other", None))?;
        let other_child = create(conn, &env, &input("Other child", Some(&other.id)))?;

        assert!(update(conn, &a.id, &input("A", Some(&b.id))).is_err());
        assert!(update(conn, &a.id, &input("A", Some(&other_child.id))).is_err());
        assert_eq!(
            update(conn, &a.id, &input("A", Some(&other.id)))?.parent_id,
            Some(other.id)
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn groups_belong_to_top_level_projects() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let acme = groups::create(conn, &env, "Acme")?;
        let site = create(conn, &env, &input("Website", None))?;
        let page = create(conn, &env, &input("Landing page", Some(&site.id)))?;
        let site = update_settings(conn, &site.id, &settings(Some(&acme.id), "active"))?;
        assert_eq!(site.group_id, Some(acme.id.clone()));
        assert!(update_settings(conn, &page.id, &settings(Some(&acme.id), "active")).is_err());
        assert!(update_settings(conn, &site.id, &settings(Some(&missing_id()), "active")).is_err());

        let other = create(conn, &env, &input("Other", None))?;
        let moved = update(conn, &site.id, &input("Website", Some(&other.id)))?;
        assert_eq!(moved.group_id, None);

        let done = update_settings(conn, &page.id, &settings(None, "done"))?;
        assert_eq!(done.weekly_minutes, Some(360));
        assert!(
            mark_reviewed(conn, &env, &page.id)?
                .last_reviewed_at
                .is_some()
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn archives_and_deletes_whole_subtree() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, &input("A", None))?;
        let b = create(conn, &env, &input("B", Some(&a.id)))?;
        set_archived(conn, &a.id, true)?;
        assert!(get(conn, &b.id)?.archived);
        assert!(set_archived(conn, &b.id, false).is_err());

        delete(conn, &a.id)?;
        assert!(list(conn)?.is_empty());
        Ok(())
    })
    .unwrap();
}
