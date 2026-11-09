use super::model::{ItemTypeInput, Preset, StatusInput, ViewInput};

fn kind_type(name: &str, icon: &str, kind: &str, minutes: Option<i32>) -> ItemTypeInput {
    ItemTypeInput {
        name: name.into(),
        icon: icon.into(),
        kind: kind.into(),
        default_minutes: minutes,
        checklist: String::new(),
    }
}

fn status(name: &str, category: &str) -> StatusInput {
    StatusInput {
        name: name.into(),
        category: category.into(),
    }
}

fn view(name: &str, layout: &str, group_by: &str, filter: &str, sort: &str) -> ViewInput {
    ViewInput {
        name: name.into(),
        layout: layout.into(),
        group_by: group_by.into(),
        filter: filter.into(),
        sort: sort.into(),
    }
}

/// The built-in presets offered when setting up a project.
pub fn presets() -> Vec<Preset> {
    vec![
        Preset {
            key: "simple".into(),
            name: "Simple".into(),
            description: "A plain list with sections. Nothing to set up.".into(),
            types: vec![],
            statuses: vec![],
            milestone_label: String::new(),
            views: vec![],
        },
        Preset {
            key: "software".into(),
            name: "Software".into(),
            description: "Features, bugs and reviews on a status board, releases as milestones."
                .into(),
            types: vec![
                kind_type("Feature", "sparkles", "task", None),
                kind_type("Bug", "bug", "task", None),
                kind_type("Chore", "wrench", "task", None),
                kind_type("PR review", "git-pull-request", "task", Some(30)),
                kind_type("Meeting", "users", "event", Some(60)),
                kind_type("Standup", "repeat", "event", Some(15)),
            ],
            statuses: vec![
                status("Backlog", "backlog"),
                status("Todo", "todo"),
                status("In progress", "active"),
                status("In review", "active"),
                status("Done", "done"),
                status("Canceled", "dropped"),
            ],
            milestone_label: "Releases".into(),
            views: vec![
                view(
                    "Board",
                    "board",
                    "status",
                    r#"{"hideBacklog":true}"#,
                    "manual",
                ),
                view(
                    "Backlog",
                    "list",
                    "none",
                    r#"{"categories":["backlog"]}"#,
                    "priority",
                ),
                view("By type", "list", "type", "{}", "manual"),
                view("Calendar", "calendar", "date", "{}", "date"),
            ],
        },
        Preset {
            key: "course".into(),
            name: "Course".into(),
            description: "Lectures on the calendar, readings and assignments by deadline.".into(),
            types: vec![
                kind_type("Lecture", "presentation", "event", Some(90)),
                kind_type("Reading", "book-open", "task", None),
                kind_type("Assignment", "file-text", "task", None),
                kind_type("Problem set", "pencil", "task", None),
                kind_type("Exam", "graduation-cap", "event", Some(120)),
                kind_type("Study session", "timer", "task", Some(50)),
            ],
            statuses: vec![
                status("To do", "todo"),
                status("Doing", "active"),
                status("Submitted", "done"),
                status("Dropped", "dropped"),
            ],
            milestone_label: "Exams".into(),
            views: vec![
                view("Week", "calendar", "date", "{}", "date"),
                view(
                    "Deadlines",
                    "table",
                    "none",
                    r#"{"hideDone":true}"#,
                    "deadline",
                ),
                view("By type", "list", "type", "{}", "manual"),
            ],
        },
        Preset {
            key: "writing".into(),
            name: "Writing".into(),
            description:
                "Chapters and drafts moving from outline to done, submissions as milestones.".into(),
            types: vec![
                kind_type("Chapter", "bookmark", "task", None),
                kind_type("Source", "book-open", "task", None),
                kind_type("Draft", "pencil", "task", None),
                kind_type("Supervisor meeting", "message-circle", "event", Some(60)),
            ],
            statuses: vec![
                status("Outline", "todo"),
                status("Drafting", "active"),
                status("Revising", "active"),
                status("Done", "done"),
                status("Cut", "dropped"),
            ],
            milestone_label: "Submissions".into(),
            views: vec![
                view("By status", "table", "status", "{}", "manual"),
                view("Board", "board", "status", "{}", "manual"),
            ],
        },
        Preset {
            key: "pipeline".into(),
            name: "Pipeline".into(),
            description: "Leads moving through stages, with days since each last moved.".into(),
            types: vec![
                kind_type("Lead", "target", "record", None),
                kind_type("Follow-up", "mail", "task", Some(15)),
                kind_type("Interview", "briefcase", "event", Some(60)),
            ],
            statuses: vec![
                status("Saved", "backlog"),
                status("Applied", "todo"),
                status("In progress", "active"),
                status("Won", "done"),
                status("Closed", "dropped"),
            ],
            milestone_label: String::new(),
            views: vec![view("Board", "board", "status", "{}", "manual")],
        },
        Preset {
            key: "job_search".into(),
            name: "Job search".into(),
            description: "One record per company, with its own tasks and notes for each phase."
                .into(),
            types: vec![
                kind_type("Application", "briefcase", "record", None),
                kind_type("Interview", "users", "event", Some(60)),
            ],
            statuses: vec![
                status("To apply", "backlog"),
                status("Applied", "todo"),
                status("Interviewing", "active"),
                status("Offer", "active"),
                status("Accepted", "done"),
                status("Closed", "dropped"),
            ],
            milestone_label: String::new(),
            views: vec![
                view("Board", "board", "status", "{}", "manual"),
                view("List", "list", "status", "{}", "manual"),
            ],
        },
    ]
}
