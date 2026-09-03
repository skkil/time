# Personal project management: project kinds, per-project configuration, and how projects feed the day and week

2026-11-01. Grades: A = meta-analysis/RCT · B = single peer-reviewed · C = practitioner/vendor/book · D = anecdote. _(secondary)_ = figure seen only in a secondary source. This builds on `2026-10-23-multi-project-overload.md` (goal conflict, goal shielding, Schmidt & DeShon, disengagement, residue, WIP, Burkeman, kill criteria), `2026-11-01-rituals-and-recovery.md` (GTD review, Shape Up appetite, "clear the deck") and `2026-11-01-high-performer-practices.md` (PARA, fixed time with flexible scope). Those findings are only referenced here, not repeated. Current model (`src-tauri/src/features/projects.rs`): `name, color, parent_id, position, archived, view`. Nothing else.

## 1. Findings table

| # | Claim | Grade | Source |
|---|---|---|---|
| 1 | Juggling more cases at once made Italian judges slower on the same workload, without changing decision quality. | B | Coviello, Ichino & Persico, _AER_ 104(2) 2014. [Kellogg](https://www.kellogg.northwestern.edu/faculty/bray/doc/judges/judge.pdf), [Unibo](https://cris.unibo.it/handle/11585/382049) |
| 2 | A follow-up scheduling change (fewer cases open at once) cut case duration by 12% _(secondary)_. | B | Bray et al., _MSOM_ 2016. [Kellogg Insight](https://insight.kellogg.northwestern.edu/reprint/a-scheduling-fix-could-make-workflow-more-effective) |
| 3 | Goal conflict, goal shielding and disengagement: see the prior file. Together they argue for few active projects and a clean way to close one. | A | `2026-10-23-multi-project-overload.md` |
| 4 | Progress principle: in 238 professionals' ~12,000 diary entries, progress in meaningful work was the strongest positive driver of inner work life. Setbacks weigh more than progress. | B _(secondary: authors' interview, not the paper)_ | [HBS Working Knowledge](https://hbswk.hbs.edu/item/6685.html) |
| 5 | If-then plans (when/where/how) raise goal attainment, d = .65 across 94 tests. This is the evidence base for a concrete next action. | A | Gollwitzer & Sheeran 2006. [Konstanz](https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f) |
| 6 | Hill charts: uphill means "figuring out what our approach is", downhill means execution. Task counts mislead because "to-do lists actually grow as the team makes progress." | C | [Shape Up ch. 13](https://basecamp.com/shapeup/3.4-chapter-13) |
| 7 | OmniFocus: "Each project has an interval for how often you intend to review it and a date when the next review is planned". The default is every week, changeable "on a per-project basis". | C | [OmniFocus manual](https://support.omnigroup.com/documentation/omnifocus/ios/2.19/en/updating-project-status-with-review/) |
| 8 | OmniFocus types: sequential (only one action available at a time), parallel, single-action list ("isn't really a project"). Status: Active, On Hold, Completed, Dropped. On Hold and Dropped disappear from the sidebar. | C | [OmniFocus planning](https://support.omnigroup.com/documentation/omnifocus/ios/2.9/en/planning-with-projects) |
| 9 | Linear projects need only name and status. They add start/target dates "that match your level of certainty" (year to day precision), milestones and a lead. Health is On track / At risk / Off track. Overdue projects "turn grey to indicate inactivity". | C | [Linear projects](https://linear.app/docs/projects), [updates](https://linear.app/docs/initiative-and-project-updates) |
| 10 | Things: headings are "only available in projects", not areas. Deadline is a property of to-dos and projects. Areas never complete _(third-party reading)_. | C | [Things headings](https://culturedcode.com/things/support/articles/2803577/), [Shortcuts](https://culturedcode.com/things/help/shortcuts-actions), [MacStories](https://club.macstories.net/posts/organizing-tasks-with-areas-and-projects-in-things) |
| 11 | Todoist: a date is when you plan to start; a deadline is when it must be done. "Only set deadlines for tasks in which missing the deadline has external consequences." Per-project layout is list, board or calendar. | C | [Todoist deadlines](https://www.todoist.com/help/articles/introduction-to-deadlines-in-todoist-uMqbSLM6U?lang=en), [list layout](https://www.todoist.com/help/todoist/features/use-the-list-layout-in-todoist-AMAhHMVRH) |
| 12 | Sunsama: channels categorise tasks so the rituals show "how you spent your time by channel". The docs advise 5–7 channels per context. Weekly objectives can be extended a week. | C | [Channels](https://help.sunsama.com/docs/channels-and-contexts), [Objectives](https://help.sunsama.com/docs/weekly-objectives) |
| 13 | Motion: projects have deadlines and auto-scheduled tasks. Workflow templates have stages with their own deadlines and optional auto-advance. | C | [Motion help](https://help.usemotion.com/workspaces-projects-and-workflows/projects-in-motion-regular-projects-vs-workflow-projects), [blog](https://www.usemotion.com/blog/project-workflow-templates) |
| 14 | Amazing Marvin hides project features behind opt-in "strategies" (Start Dates, Dependencies, Most Important Projects, Planning Ahead). | C | [Marvin strategies](https://help.amazingmarvin.com/basic-features-and-how-to/strategies/how-to-turn-features-on-and-off-with-strategies), [PM collection](https://help.amazingmarvin.com/en/collections/1139325-project-management) |
| 15 | 12 Week Year: weekly execution score = tactics done ÷ planned. Moran's ≥85% threshold appears only in summaries _(secondary)_. | C | [summary](https://concepts.dsebastien.net/concept/12-week-year/) |
| 16 | Height shut down on 24 Sep 2025. It is no longer a live comparator. | C | [AlternativeTo](https://alternativeto.net/news/2025/3/height-project-management-tool-to-shut-down-by-september-2025/) |
| 17 | Side sheets hold "supplementary content" and stay visible next to the main content. They are mainly for tablet and desktop. | C | [Material side sheets](https://material.io/components/sheets-side) |
| 18 | Drawers suit "sub-tasks that are too complex for a simple modal". "Long, complex flows need a page". When the underlying screen's context matters, use an overlay; otherwise a page is the default. | C _(cites NN/g; NN/g not read directly)_ | [Smashing 2026](https://smashingmagazine.com/2026/03/modal-separate-page-ux-decision-tree) |

## 2. Project kinds and what they need

| Kind | Example | Ends? | Needs | Doesn't need |
|---|---|---|---|---|
| **Finite project** (GTD: an outcome needing >1 action; PARA project) | Ship CLIP v2, internship application | Yes | Outcome / definition of done, optional target date, a visible next action, progress, close-with-lesson | Recurring tasks as the main content |
| **Area** (PARA area; Things area; OmniFocus single-action list) | Health, a course, job, Life | No | Weekly time target (Sunsama channels, #12), recurring tasks, habits, a slow review cadence | Done state, progress bar, deadline |
| **Maintenance** (a special case of area) | Taxes, admin, home | No | Recurring tasks, low review cadence | Its own type: an area covers it |
| **Exploratory / creative** | A side idea, a novel draft | Fuzzy | Appetite (fixed time, variable scope; Shape Up), uphill/downhill status (#6), kill criteria (prior file) | Task-count progress, which misleads (#6) |
| **Coursework with deadlines** | Semester course | Term-bound | A hard deadline per deliverable (task-level deadline, #11), weekly hours | Project-level deadline beyond the term end |
| **Client-less side project** | Personal app | Usually never | Parked/active state, appetite, stale prompt | Lead, health reports (team features) |

The kinds really split on two axes. Does it end? That is Project vs Area. Is time the constraint, or the scope? That is appetite vs deadline. Sequential ordering matters only for a minority of finite projects (OmniFocus #8). In Todoist-shaped tools the first open task in list order already acts as the next action.

Method notes:
- **Burkeman:** serialize 1–2 big projects.
- **Personal Kanban:** "no more than three" in progress.
- **Judges evidence (#1–2):** the strongest field data that fewer projects open at once speeds finishing. It is a single profession, though.
- **12 Week Year and Agile-for-one:** both converge on a weekly cadence that scores actions, not outcomes (#15).

## 3. Competitor per-project configuration

| Setting | OmniFocus | Things 3 | Todoist | Linear | Sunsama | Motion | Marvin | Notion (template) |
|---|---|---|---|---|---|---|---|---|
| Project vs area | Single-action list | **Areas vs projects** | No | No (teams / initiatives) | Channels ≈ areas | Folders | Categories vs projects | User-defined |
| Ordering type | **Seq / parallel / SAL** | No | No | No | No | Stages | Dependencies (strategy) | No |
| Status | Active / On Hold / Done / Dropped | Done / cancel | Archive | Custom per team | n/a | Stage | Done | Not started / In progress / On hold / Done |
| Target date / deadline | Due + defer | Deadline | Task deadline (paid) | Start + target (fuzzy precision) | n/a | Deadline + stage deadlines | Due / start dates | Date |
| Outcome / notes | Note | Notes | Description | Overview + milestones | Objective text | Description | Note | Brief |
| Milestones | No | Headings | Sections | **Milestones** | No | Stages | No | Sub-items |
| Review cadence | **Per-project interval** (default weekly) | No | No | Update schedule + grey when inactive | Weekly ritual by channel | No | No | No |
| Time target / actual | No | No | No | No | **Time by channel** | Auto-schedule | Time tracking | No |
| Default view | Perspective | List | **List / board / calendar** | List / board / timeline | n/a | List / Kanban / Gantt | Several | Any |
| Templates | No | No | Yes | Yes | No | **Workflow templates** | Yes | Yes |

Pattern: personal tools (Things, Todoist) configure almost nothing per project. Team tools (Linear, Motion, Notion) configure a lot, but the extras (lead, health, stages) serve coordination. Only OmniFocus ties a project to a review rhythm, and only Sunsama ties categories to weekly time. Those two ideas are the gap skkil can fill.

## 4. Recommended model

### Types (2, plus a flag)

1. **Project.** Finite, can be closed. Gets outcome, progress, next action, close-with-lesson.
2. **Area.** Ongoing, never closes. Gets a weekly time target and recurring tasks. Habits can link to it (habit tracking by project time already exists).
3. **"In order" flag** on a Project, not a third type. When it is on, only the first open task is surfaced as the next action, the OmniFocus sequential behaviour (#8). Default off. Single-action list = Area, so no separate type.

Nesting stays, but a Project may sit under an Area and not the reverse. That is the PARA reading of "projects serve areas".

### Per-project settings (≤6)

| # | Setting | Applies to | Why |
|---|---|---|---|
| 1 | **Kind**: Project / Area | All | Splits what ends from what doesn't (PARA, Things #10) |
| 2 | **Status**: Active / Paused / Done / Dropped (Area: Active / Paused) | All | OmniFocus #8. Paused hides it from Today and the sidebar. Ties to Bet 3's active slots |
| 3 | **Outcome** (one line, "done when…") | Project | GTD definition. Feeds weekly outcome linking |
| 4 | **Weekly time** (hours/week; for a Project it reads as the appetite) | All | Sunsama #12, Shape Up appetite. Time tracking already exists, so actual vs target is free |
| 5 | **Target date** (soft) + optional **kill criteria** line ("stop if ___ by ___") | Project | Todoist #11 keeps hard deadlines on tasks. Linear #9 supports fuzzy precision (month/quarter) |
| 6 | **Review every** 1 / 2 / 4 weeks (default 1 for Project, 4 for Area) | All | OmniFocus #7, the one feature only it has. Drives the stale prompt |

Keep as display prefs, outside the "settings": colour, list/board view, in-order flag.

### Drop or hide

- **Project-level priority.** Status plus the active cap does this job.
- **Milestones as a separate entity.** Sections already cover it, like Things' headings.
- **Health / RAG status.** A team reporting artifact (Linear #9).
- **Lead / members / templates / stages.** Solo use, and Motion-style stages are heavy. Templates could come later as "duplicate project".
- **Hill chart as a drag widget.** Keep only a two-state "figuring out / doing" toggle on exploratory projects at most. No evidence it helps individuals (gap).
- **Progress as task %.** It misleads (#6). Show time vs weekly target and the last-moved date instead.
- **Timeline / Gantt view.** Little value for one person, and it costs a lot to build.

### Integration with day / week / review

- **Week timetable:** each Active project or area with a weekly time target gets a row/bar: "CLIP 4.5 / 6 h". Actual comes from time entries; planned comes from time blocks. Show it as a fraction, never a grade (Bet 4). Planning a week shows unallocated target hours as a nudge to block time.
- **Today:** one **next action** per Active project: the first open task, or the only one if the in-order flag is on. Shown in a collapsed "Projects" strip, capped at the active-slot count. Each project gets at most one line, so Today doesn't flood (implementation intentions, #5).
- **Weekly review ("Clear the deck"):** list projects that are due for review per their interval, plus any Active project with no completed task and no tracked time since its last review. Linear's "grey" idea (#9) maps to a dimmed dot in the sidebar. Actions: Continue / Pause / Close (with "what I learned") / Drop. These are the Bet 3 "edit". An Active project without an open task gets "Add a next action?" (GTD).
- **Quarter:** priorities link to Projects. Areas show the quarter's total hours.

### Drawer vs page

**Use both.** A **side sheet** for quick settings (the six fields), opened from the sidebar or the project header, with the task list visible behind. Settings are supplementary to the list and need its context (#17, #18). The **project itself stays a full page** (it already is a route) with a header strip showing outcome, weekly time bar, status and next review. Edit those inline in the header, which is the Smashing recommendation for repeated edits (#18). Don't build a multi-tab settings page; with ≤6 fields it would be the "complex flow" that doesn't exist. Replace the current `ProjectDialog` modal with the sheet once the field count passes about 3.

## 5. Gaps

- No peer-reviewed study on per-project review intervals or stale-project prompts for individuals. OmniFocus and Linear are vendor practice only.
- No study of individuals' optimal number of active projects. The judges' data (#1–2) is one profession; the cap of 3 is practitioner lore.
- Time budgets vs task estimates for individuals: no direct comparison found. Planning-fallacy evidence is in the prior file. The appetite/budget claim is C.
- Hill charts, the 12 Week Year 85% threshold and the progress principle's 28% "small events" figure are untested for personal planners, and the last two are secondary only.
- I couldn't read NN/g's modal/drawer articles or the Material 3 guidelines body directly; the guidance is via Smashing and material.io snippets.
- Not checked: OmniFocus 4's current docs (URL 404'd; 2.x manual used), the Things progress pie, Notion's official template fields, Linear for personal (free) use specifics, and Marvin's time-budget features (none found).
