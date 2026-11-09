use super::*;
use crate::testing::{db, env, task_input};
use crate::{projects, tasks};

fn task(title: &str, children: Vec<ImportTask>) -> ImportTask {
    ImportTask {
        task: task_input(title, None),
        children,
    }
}

fn project(name: &str, tasks: Vec<ImportTask>, sections: Vec<ImportSection>) -> ImportProject {
    ImportProject {
        name: name.into(),
        color: "blue".into(),
        tasks,
        sections,
    }
}

#[test]
fn imports_sections_and_nested_tasks() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let ids = import(
            conn,
            &env,
            &[project(
                "Home",
                vec![task("Fix sink", vec![task("Buy washer", vec![])])],
                vec![ImportSection {
                    name: "Garden".into(),
                    tasks: vec![task("Mow", vec![])],
                }],
            )],
        )?;
        assert_eq!(ids.len(), 1);
        let all = tasks::list(conn)?;
        let washer = all.iter().find(|t| t.title == "Buy washer").unwrap();
        let sink = all.iter().find(|t| t.title == "Fix sink").unwrap();
        assert_eq!(washer.parent_id, Some(sink.id.clone()));
        let mow = all.iter().find(|t| t.title == "Mow").unwrap();
        assert!(mow.section_id.is_some());
        assert_eq!(mow.project_id, Some(ids[0].clone()));
        Ok(())
    })
    .unwrap();
}

#[test]
fn a_bad_row_leaves_nothing_behind() {
    let (db, env) = (db(), env());
    db.call(|conn| {
        let result = import(
            conn,
            &env,
            &[
                project("Good", vec![task("Fine", vec![])], vec![]),
                project("Bad", vec![task("   ", vec![])], vec![]),
            ],
        );
        assert!(result.is_err());
        assert!(projects::list(conn)?.is_empty());
        assert!(tasks::list(conn)?.is_empty());
        Ok(())
    })
    .unwrap();
}
