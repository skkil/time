use super::*;
use crate::tasks::{self, create, set_completed};
use crate::testing::{db, env, task_input as input};
use crate::types::date;

#[test]
fn waits_until_every_blocker_is_done() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let launch = create(conn, &env, &input("Launch", None))?;
        let copy = create(conn, &env, &input("Write copy", None))?;
        let site = create(conn, &env, &input("Build site", None))?;
        add(conn, &env, &launch.id, &copy.id)?;
        let launch = add(conn, &env, &launch.id, &site.id)?;
        assert_eq!(launch.blocked_by.len(), 2);
        assert_eq!(launch.waiting_on.len(), 2);

        set_completed(conn, &env, &copy.id, true)?;
        let launch = tasks::get(conn, &launch.id)?;
        assert_eq!(launch.waiting_on, vec![site.id.clone()]);
        assert_eq!(launch.blocked_by.len(), 2);

        let launch = remove(conn, &launch.id, &site.id)?;
        assert!(launch.waiting_on.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn refuses_loops_self_and_repeating_blockers() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let a = create(conn, &env, &input("A", None))?;
        let b = create(conn, &env, &input("B", None))?;
        let c = create(conn, &env, &input("C", None))?;
        add(conn, &env, &a.id, &b.id)?;
        add(conn, &env, &b.id, &c.id)?;
        assert!(add(conn, &env, &c.id, &a.id).is_err());
        assert!(add(conn, &env, &a.id, &a.id).is_err());

        let mut daily = input("Inbox zero", None);
        daily.due_date = Some(date("2026-11-03"));
        daily.recurrence = Some("every day".into());
        let daily = create(conn, &env, &daily)?;
        assert!(add(conn, &env, &a.id, &daily.id).is_err());

        tasks::delete(conn, &b.id)?;
        assert!(tasks::get(conn, &a.id)?.blocked_by.is_empty());
        Ok(())
    })
    .unwrap();
}
