# Design brief: plan where you live, look back by period, and projects that fit how you work

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-11-02 | Jennifer | For Rebecca. Covers spec-organize-2026-11-02.md (Day, Week, Habits, Reports) and the approved project task model (research/2026-11-02-project-task-structure.md). Founder approved every decision listed here on 2026-11-02. |

**Bottom line:** two changes, one design pass. First, Week becomes the place to plan the week: outcomes, quarter priorities, habits and project hours sit over the time grid, and Reports becomes a calm archive of weeks and quarters. Second, Projects becomes a workspace where each project has its own item types, statuses, milestones and saved views, set up from presets. A software project, a university course and a job search should each feel native, and a plain project must look exactly as simple as today. **Most needed back:** an updated `DESIGN.md` for the calm-canvas direction, then low-fi directions for the two hardest surfaces (Week strip, project workspace) before high fidelity on everything.

## 1. Problem and who has it

**The founder first** [primary: own setup, 2026-10-23]: a student and software developer who runs courses, side projects (CLIP, STiTy) and life admin. Today that takes four tools:
- Notion for the quarter and week pages, the habit O/X grid and reflections.
- Todoist for timed blocks and courses.
- Clockify for hours, copied into Notion by hand.
- Opal for phone blocking.

Their success test: stop opening Notion and Clockify for 2 weeks.

Three problems in the current build [primary: code read, 2026-11-02]:

1. **The week's plan is in the wrong place.** Outcomes and quarter priorities live only in Reports. Week shows only the time grid. Habits are logged in Reports, not on Day.
2. **Reports is split by data type** (Time, Habits, Reviews). The real question is "how was week 44?", and answering it takes three tabs.
3. **Projects can't separate kinds of work.** A task is one type with done/not done, a section, and nothing else. In the founder's words: there "has to be clear separation between meetings, recurring events, reviews, features, backlogs", and "when i do study tasks, this system is entirely different". Todoist "is too rigid", and "the section-based approach is not overarching".

**After the founder:** self-directed people who run different kinds of projects at once, such as developers (work plus side projects), students (courses plus projects) and writers. 11 of 19 people in one study gave up on task apps for paper or docs because the apps didn't fit their work [secondary: Haraty et al., GI 2012]. Yet most people never change a default [secondary: Spool, UIE 2011; Page et al., CHI 1996]. **The design has to serve both: it must fit any kind of project, and work fully without any setup.**

## 2. The user's situation and state of mind

| Moment | Where | State of mind | What they need from the screen |
|---|---|---|---|
| Monday morning, coffee, planning the week | Week | Hopeful but wary of over-planning; last week half-slipped | See last week's leftovers, the quarter's 3 priorities and this week's ≤3 outcomes in one glance, then block time. Nothing shouting. |
| Mid-afternoon, between a meeting and a feature | Day | Context-switched, slightly scattered | Where am I in the day, what's next, tick a habit in one click. Meetings stand out as fixed points. |
| Start of a semester, new course | Projects → New project | Motivated, wants to be set up *now*, impatient with configuration | Pick "Course", type the lectures' times, done in under 2 minutes. |
| Mid-sprint at work | A software project | Focused, keyboard-driven, many small items | Board by status, bugs visibly apart from features, backlog out of the way. Feels like a tool for professionals, not a toy. |
| Sunday evening, looking back | Reports → Week N | Tired and reflective. Could feel judged if the week went badly | Read the week like a journal entry: how it felt, what moved, hours, habits. One gentle suggestion at most. |
| Returning after a missed week | Reports, Week | Guilty, expecting a pile-up | Neutral "not reviewed" marks, no red counts, one click back into the weekly review. |

## 3. User promise

- **Week:** "Your week on one screen: what matters, and when you'll do it."
- **Day:** "Where you are now, with your fixed points marked."
- **Reports:** "Your weeks, as they actually went. Read, don't manage."
- **Projects:** "Each project works the way that kind of work works, without building a system first."

They should feel calm and capable. They should never feel managed, graded or behind.

## 4. Proof the design should surface

- **Outcome evidence:** linked tasks done/total and hours on them, as fractions ("2 of 5 · 3.5 h"). Never a percentage.
- **Hours as the weekly headline:** tracked vs planned. Quarter shows 13 bars of hours, like the founder's Notion "Focused Time" column.
- **Habits:** "5 of 6 days", "x of last 14", with planned rest days shown as rest, not misses.
- **Project hours vs target:** "CLIP 4.5 / 6 h".
- **Time by item type** inside a project and in Week N: "Meetings 6 h · Features 9 h · Bugs 2 h". Rivals don't have this: Linear, Notion and Todoist don't track time.
- **Pipelines:** "days since last move" on each card.

## 5. Constraints

**Direction (calm canvas, founder 2026-11-02; see memory `calm-canvas-direction`):**
- Apple-glass style on a code-drawn sky that follows the time of day. No image or video assets.
- No boxes or cards as layout. Type and spacing sit directly on the backdrop.
- Top-left profile circle (menu: Settings, Reports), top-centre toggle Day · Week · Projects.
- Motion should feel fluid and lifelike, not static.
- Not a Todoist clone.
- Projects is a separate, Jira-like workspace. This is the one place that can be denser, but it still lives on the canvas.

**`DESIGN.md` is stale.** It still describes the departure board, green chrome and "no glass". Please rewrite §2–3 for calm canvas before this pass. Keep what still holds:
- Hanken Grotesk for everything, tabular figures, Pretendard for Hangul.
- Status never shown by colour alone.
- Red only for urgent and destructive.
- The voice rules.

**Never show:** streaks, scores, grades, percentages of progress, rankings, comparisons with other people, red overdue counts, confetti, emoji [policy: usable-flow-synthesis §5; DESIGN.md §2].

**Platform:**
- Tauri desktop on Linux (WebKitGTK) and macOS. Window sizes from 900×600 up.
- Keyboard-first: every action reachable by keys, shortcuts shown in tooltips and menus.
- Reduced motion shows end states.
- WebKitGTK can render blur and WebGL slowly. Glass must degrade to plain translucency.

**Content:**
- English UI first. Labels must survive Korean (longer and shorter strings, no truncation of the key noun).
- Copy is placeholder until Vanessa reviews it.

**Technical (from the code):**
- Outcomes max 3 open per week, carried at most twice.
- Quarter priorities max 3.
- Habits: build / quit / limit, counted in times or minutes, 0–2 planned skip days a week, optional anchor ("After I ___").
- Data exists for everything on Day, Week and Reports. The project model (§6.4) is new data.

## 6. Flows and screens in scope

Screen IDs are for cross-reference with the specs. Layout is yours; the notes say what must be there and how it behaves.

### 6.1 Day (S-DAY), small changes to the existing canvas

| # | What | Behaviour and states |
|---|---|---|
| 1 | **Habit dots** under the date line, one per habit due today, in time-of-day order | Click toggles done (yes/no habits). Counted habits (times or minutes) open a small control. Quit habits show "clean today" and default to clean. Hidden when no habit is due. Tooltip: name, plus "x of last 14". |
| 2 | **Events as anchors** on the timeline (meetings, lectures, exams) | Look different from tasks: fixed points, not checkable. Events can't be "done", and the reader should see that at a glance. |
| 3 | **"Serves: outcome"** in the task detail on the right | Shown when this or next week has outcomes. Change it inline. |
| 4 | Item **type icon and status** in the task detail | Only when the project uses types/statuses (§6.4). Simple projects show nothing new. |

### 6.2 Week (S-WEEK): the plan strip above the time grid

The strip has up to four rows. Empty rows don't render. It's the riskiest surface for calm: it must read as one quiet band, not a dashboard.

| # | Row | Content | Behaviour and states |
|---|---|---|---|
| 1 | **Quarter line** (in the header meta) | "Q4 · Week 7 of 13", plus the ≤3 priority titles | Click the label to open the Quarter page in Reports. Priority titles can be edited from a small popover. With no quarter: "Plan a quarter" opens inline setup (label, start week, up to 3 priorities). |
| 2 | **Outcomes** | Up to 3, each with title, linked tasks done/total, hours, and the priority it serves | Add, rename and remove inline. States: open, achieved, carried (with "carried ×1/×2"). Hitting the cap shows the backend message ("3 outcomes max. Finish or drop one first."). Empty: "Up to 3 outcomes, each a finished result." |
| 3 | **Habits** | Collapsed: one line of 7 day marks, each showing done/due for that day. Expanded: one line per habit × 7 cells + "x of last 14" | The collapse state is remembered. Past days and today are editable, future days read-only. Rest days look like rest. **Edit habits** opens the Habits sheet (S-HABITS). |
| 4 | **Projects** | Each active project or area with a weekly target: "CLIP 4.5 / 6 h", with planned block hours as a lighter mark | Over target looks the same as under (no red). Paused or done projects are hidden. Collapsible like Habits. |
| 5 | **Review nudge** (Mon–Wed only) | "Week 44 isn't reviewed · Review (about 10 min)" | One neutral line, gone once reviewed or after Wednesday. Opens the weekly ritual. |
| 6 | **Grid: events vs blocks** | Events (meetings, lectures, recurring standups) and time blocks for tasks share the grid | Events are solid fixed anchors. Task blocks are tinted with a checkbox (pattern from Morgen). The same thing is never drawn twice. Recurring events repeat quietly. |

Must still fit at 900 px window height with at least 8 hours of grid visible. If it doesn't, rows collapse by default and Projects goes first.

### 6.3 Habits sheet (S-HABITS), opened from Week's habit row

- A list of active habits, each with Edit and Archive. **New habit** opens the existing habit form, which includes the anchor field.
- **Archive** shows "You ran this N weeks" (retiring is a normal, supported ending).
- The ActivityWatch notice ("tracking unavailable") lives here, quiet, with a retry.
- Empty: "No habits yet", with New habit.
- Side sheet on the canvas, not a modal page.

### 6.4 Projects workspace (S-PROJ): the new model

**The model in one paragraph.** Every item is either a **task** (do it, check it off) or an **event** (happens at a time: meeting, lecture, exam, interview). Every status belongs to one of five fixed **categories**: backlog, todo, active, done, dropped. Each project can then turn on four building blocks:
- **Item types**: name, icon, task or event, default duration, default checklist.
- **Statuses**: named freely, each in a category.
- **Milestones**: named and dated, e.g. Release 0.3, Midterm, Chapter 2.
- **Saved views**: list, board, calendar or table; grouped by section, type, status, milestone or date; plus filter and sort.

Sections stay, as one way to group. A **preset** sets all four at creation. A "Simple" project uses none of them and looks like today.

**Presets** (contents are a first draft; please tell me if a preset feels wrong):

| Preset | Item types (event types marked ◆) | Statuses (category) | Milestones | Default views |
|---|---|---|---|---|
| **Simple** | Task | To do (todo) · Done (done) | off | List by section |
| **Software** | Feature · Bug · Chore · PR review · ◆Meeting · ◆Standup (recurring) | Backlog (backlog) · Todo (todo) · In progress (active) · In review (active) · Done (done) · Canceled (dropped) | Releases | Board by status · Backlog list · List by type · Calendar |
| **Course** | ◆Lecture (recurring) · Reading · Assignment · Problem set · ◆Exam · Study session (50 min) | To do · Doing (active) · Submitted (done) · Dropped | Exams | Week calendar · Deadlines table · List by type |
| **Writing** | Chapter · Source · Draft · ◆Supervisor meeting | Outline (todo) · Drafting (active) · Revising (active) · Done · Cut (dropped) | Submissions | Table by status · Board |
| **Pipeline** (job search, content, outreach) | Lead · Follow-up · ◆Interview | Saved (backlog) · Applied (todo) · In progress (active) · Won (done) · Closed (dropped) | off | Board by status, with "days since last move" on each card |

Screens:

| ID | Screen | Must have | States and behaviour |
|---|---|---|---|
| S-PROJ-1 | **Workspace nav** | Inbox, Someday, then Areas with their Projects (max depth 3); inactive projects grouped under "Inactive" | Exists today (`ProjectsSpace`); restyle only. |
| S-PROJ-2 | **Project page header** | Name, colour, kind (project or area), status, outcome, weekly hours vs target, next review date, plus **time by type** this week when types are on | Inline editing (exists as `ProjectBrief`). |
| S-PROJ-3 | **View switcher** | The project's saved views as tabs or a menu, plus "New view" | Each view remembers layout, group, filter and sort. Switching is instant, with no page change. |
| S-PROJ-4 | **List layout** | Items grouped by the view's grouping, sub-tasks nested, type icon, status, date, deadline, estimate | Drag to reorder inside a group and to move between groups. When grouped by status, dragging changes the status. |
| S-PROJ-5 | **Board layout** | Columns by status (or type, or milestone); cards show title, type icon, date, subtask count, "days since last move" for pipelines | Drag between columns. Done and dropped columns collapse by default. Must handle 50+ cards per column without feeling heavy. |
| S-PROJ-6 | **Calendar layout** | Week (default) or month; events at their times, tasks on their dates | Drag to reschedule. The same visual language as the Week grid (events solid, tasks tinted). |
| S-PROJ-7 | **Table layout** | Columns: title, type, status, milestone, date, deadline, estimate, tracked time | Sort by column header. Good for "all deadlines this term". |
| S-PROJ-8 | **Item detail** | Title, notes, type, status, milestone, outcome, date/time, deadline, recurrence, estimate, next-step note, sub-tasks, tracked time. Events: start–end, location/link, notes, "counts as time spent" | Task vs event must look different here as well. Changing a task's type to an event type asks for a time. |
| S-PROJ-9 | **New project** | Name, then preset choice (Simple pre-selected), each preset with a one-line description and a preview of its types and views | Done in under 2 minutes for Course, including recurring lectures. "Simple" never asks more questions. |
| S-PROJ-10 | **Project settings** (side sheet) | Existing settings (kind, status, outcome, weekly target, target date, stop-if, review cadence, in-order), plus four sections: **Types, Statuses, Milestones, Views** | Each of the four is off until turned on or set by a preset (gentle slope). Types: add, rename, icon, task or event, default duration, checklist. Statuses: add, rename, reorder, pick a category. Deleting a status or type in use asks where its items go. One entry point; no separate settings app. |
| S-PROJ-11 | **Presets: export and import** | "Save as preset" from project settings, "Import preset" from New project | A file on disk. No marketplace. |
| S-PROJ-12 | **Quick add** with type and status | The existing quick-add parser gains a type token; Jennifer and Emil fix the syntax in the project-model spec | Highlight the type token like the other tokens. |

**Type icons:** chosen from a curated set of outline icons (no emoji, per DESIGN.md). Types get icons, not colours, because projects already own colour. Tell me if you see it differently.

### 6.5 Reports (S-REP): a read-only archive by period

Reached from the profile menu (and `Mod+4`). It reads like a journal, not a dashboard.

| ID | Screen | Must have | States and behaviour |
|---|---|---|---|
| S-REP-1 | **Weeks list** | Newest first, grouped under quarter headings (which link to the Quarter page). Row: Week N, dates, felt, outcomes achieved/total, hours, Reviewed or Not reviewed | The current week is not listed; a line says "This week is in Week". Weeks with no activity collapse into "n quiet weeks". "Not reviewed" uses muted text with no icon or colour. |
| S-REP-2 | **Week N page** | Header (Week N, dates, felt, reviewed state, Edit review), then the insight line, hours (tracked and planned), Outcomes with evidence and "Also finished", Time by project (top 3 + Other), **Time by type** (new), Habits (7-day read-only grid, "x of y days"), Days (7 lines: felt and note), Notes (worked, fell short, one change), and at the bottom a collapsed **Entries** list | Entries open the existing time-entry editor: this is the one allowed edit, because it fixes data rather than planning. Empty sections don't render. |
| S-REP-2a | **Week N, last week not yet reviewed** | Only the header and "Review week 44 · about 10 min" | No numbers until reviewed (felt before data). From the next Wednesday, data shows, marked "Not reviewed". |
| S-REP-3 | **Insight line** | At most one sentence plus one link, e.g. "Planned 22 h, tracked 14 h · Plan fewer blocks" | Rule-based, so it's often absent, and the page must look complete without it. It must not read as a scold. |
| S-REP-4 | **Quarter page** | Label, "Week x of 13", up to 3 priorities with achieved count and wrap-up note, 13 week cells (hours bar, outcomes achieved/total, reviewed mark), prev/next quarter | A cell opens its Week N. Read-only. |

### 6.6 Rituals (S-ZEN): touch points only

No redesign. Check that the weekly review's "Clear the deck" and "Plan next week" steps show item types and statuses for projects that use them, and that backlog items never appear as overdue.

## 7. Success metrics

Founder use over weeks 45–47, judged by self-report and local data [assumption: 3 weeks is enough]:
- Notion week page and Clockify not opened for 2 weeks in a row.
- Habits logged from Day or Check out on ≥5 of 7 days.
- Weekly review finished 3 weeks in 3.
- At least one non-Simple project (Software or Course) in daily use by week 47, with events on the grid.

Later, with 5 real people (2 devs, 2 students, 1 writer): each sets up one current project from a preset in under 2 minutes without help.

**Guardrail:** if the Week strip feels busy, or Simple projects grow any new visible control, that's a fail.

## 8. References and anti-references

| Use | For |
|---|---|
| Linear | Fixed status categories with user-named statuses; speed; keyboard feel in the project workspace |
| Tana supertags / Anytype types | A user type sitting on a fixed base kind; templates attached to a type |
| Plane | Per-project feature switches, off by default |
| Morgen, Sunsama | Events vs scheduled tasks on one grid; events count as work only when claimed |
| The founder's Notion week page | The content of the Week strip and Week N page (priorities, habit O/X grid, 3 reflections, focused hours) |
| Things 3 | How calm a dense list can feel |

| Avoid | Why |
|---|---|
| ClickUp, Jira company-managed | "Overwhelming for new users" [anecdote: G2 and Capterra reviews]; settings sprawl |
| Notion blank page | Setup before use; systems dropped after ~2 weeks [anecdote] |
| Todoist | The founder's explicit anti-reference: rigid, section-bound, "clone of todoist" was a rejection |
| Rize-style dashboards, Fitbit-style rings | Scores, grades, shame |
| Boxed card layouts, top-bar + drawer chrome | Rejected by the founder ("boxed looks are NOT what i am going for") |

## 9. Open questions for Rebecca

| # | Question | My default |
|---|---|---|
| R1 | How does a dense, Jira-like workspace (board, table) live on the calm canvas without boxes? | Glass is used only for the board columns and the table body; everything else sits on the sky |
| R2 | Event vs task-block visual language, the same on Day, Week and project calendar | Events solid and fixed; tasks tinted with a checkbox |
| R3 | Type identity: icon only, or icon + tint? | Icon only; project keeps the colour |
| R4 | Week strip: four rows or fewer, and is the habit row a dot line or a mini grid? | Outcomes always visible, Habits and Projects collapsed to one line each |
| R5 | Should Reports get its own backdrop mood (e.g. a dusk sky) to signal "looking back"? | Yes, subtle; same sky engine |
| R6 | Does any preset feel wrong or missing for its users (§6.4 table)? | — |

## 10. What I'd like back

1. **`DESIGN.md` rewritten for calm canvas**: thesis, tokens, glass rules, motion, the decision log entry.
2. **Low-fi, 2 directions each** for S-WEEK (strip + grid with events) and S-PROJ (board + list + item detail + settings), with your recommendation.
3. After the founder picks: **high-fi for every screen in §6**, including empty, loading, error and "not reviewed" states, light and dark, at 900×600 and 1440×900.
4. A short handoff note for Emil: tokens, components, motion values.

Engineering detail for Day, Week, Habits and Reports is in `spec-organize-2026-11-02.md`. An engineering spec for the project model comes next from me, in parallel with your work. Your board and settings designs will shape it, so please flag anything in §6.4 that is hard to design well.
