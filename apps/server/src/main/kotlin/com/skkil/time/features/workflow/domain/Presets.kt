package com.skkil.time.features.workflow.domain

private fun type(name: String, icon: String, kind: String, minutes: Int? = null) =
    ItemTypeInput(name, icon, kind, minutes, "")

private fun view(name: String, layout: String, groupBy: String, filter: String, sort: String) =
    ViewInput(name, layout, groupBy, filter, sort)

/** The built-in project setups. Simple sets nothing, so a plain project looks as before. */
val PRESETS: List<Preset> =
    listOf(
        Preset("simple", "Simple", "A plain list with sections. Nothing to set up.", listOf(), listOf(), "", listOf()),
        Preset(
            key = "software",
            name = "Software",
            description = "Features, bugs and reviews on a status board, releases as milestones.",
            types =
                listOf(
                    type("Feature", "sparkles", "task"),
                    type("Bug", "bug", "task"),
                    type("Chore", "wrench", "task"),
                    type("PR review", "git-pull-request", "task", 30),
                    type("Meeting", "users", "event", 60),
                    type("Standup", "repeat", "event", 15),
                ),
            statuses =
                listOf(
                    StatusInput("Backlog", "backlog"),
                    StatusInput("Todo", "todo"),
                    StatusInput("In progress", "active"),
                    StatusInput("In review", "active"),
                    StatusInput("Done", "done"),
                    StatusInput("Canceled", "dropped"),
                ),
            milestoneLabel = "Releases",
            views =
                listOf(
                    view("Board", "board", "status", """{"hideBacklog":true}""", "manual"),
                    view("Backlog", "list", "none", """{"categories":["backlog"]}""", "priority"),
                    view("By type", "list", "type", "{}", "manual"),
                    view("Calendar", "calendar", "date", "{}", "date"),
                ),
        ),
        Preset(
            key = "course",
            name = "Course",
            description = "Lectures on the calendar, readings and assignments by deadline.",
            types =
                listOf(
                    type("Lecture", "presentation", "event", 90),
                    type("Reading", "book-open", "task"),
                    type("Assignment", "file-text", "task"),
                    type("Problem set", "pencil", "task"),
                    type("Exam", "graduation-cap", "event", 120),
                    type("Study session", "timer", "task", 50),
                ),
            statuses =
                listOf(
                    StatusInput("To do", "todo"),
                    StatusInput("Doing", "active"),
                    StatusInput("Submitted", "done"),
                    StatusInput("Dropped", "dropped"),
                ),
            milestoneLabel = "Exams",
            views =
                listOf(
                    view("Week", "calendar", "date", "{}", "date"),
                    view("Deadlines", "table", "none", """{"hideDone":true}""", "deadline"),
                    view("By type", "list", "type", "{}", "manual"),
                ),
        ),
        Preset(
            key = "writing",
            name = "Writing",
            description = "Chapters and drafts moving from outline to done, submissions as milestones.",
            types =
                listOf(
                    type("Chapter", "bookmark", "task"),
                    type("Source", "book-open", "task"),
                    type("Draft", "pencil", "task"),
                    type("Supervisor meeting", "message-circle", "event", 60),
                ),
            statuses =
                listOf(
                    StatusInput("Outline", "todo"),
                    StatusInput("Drafting", "active"),
                    StatusInput("Revising", "active"),
                    StatusInput("Done", "done"),
                    StatusInput("Cut", "dropped"),
                ),
            milestoneLabel = "Submissions",
            views =
                listOf(
                    view("By status", "table", "status", "{}", "manual"),
                    view("Board", "board", "status", "{}", "manual"),
                ),
        ),
        Preset(
            key = "pipeline",
            name = "Pipeline",
            description = "Leads moving through stages, with days since each last moved.",
            types =
                listOf(
                    type("Lead", "target", "record"),
                    type("Follow-up", "mail", "task", 15),
                    type("Interview", "briefcase", "event", 60),
                ),
            statuses =
                listOf(
                    StatusInput("Saved", "backlog"),
                    StatusInput("Applied", "todo"),
                    StatusInput("In progress", "active"),
                    StatusInput("Won", "done"),
                    StatusInput("Closed", "dropped"),
                ),
            milestoneLabel = "",
            views = listOf(view("Board", "board", "status", "{}", "manual")),
        ),
        Preset(
            key = "job_search",
            name = "Job search",
            description = "One record per company, with its own tasks and notes for each phase.",
            types = listOf(type("Application", "briefcase", "record"), type("Interview", "users", "event", 60)),
            statuses =
                listOf(
                    StatusInput("To apply", "backlog"),
                    StatusInput("Applied", "todo"),
                    StatusInput("Interviewing", "active"),
                    StatusInput("Offer", "active"),
                    StatusInput("Accepted", "done"),
                    StatusInput("Closed", "dropped"),
                ),
            milestoneLabel = "",
            views =
                listOf(
                    view("Board", "board", "status", "{}", "manual"),
                    view("List", "list", "status", "{}", "manual"),
                ),
        ),
    )
