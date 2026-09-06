# Task structure inside projects: how much configurability, and of what

_2026-11-02 · Jennifer (PM) · For: founder · Method: 3 parallel web scans (tool primitives, workflows by project type, configurability evidence), ~100 searches and fetches, plus a code read of `tasks.rs`, `sections.rs`, `projects.rs`. Grades: A meta-analysis/RCT · B single peer-reviewed study · C practitioner/vendor · D anecdote._

**Bottom line.** Don't build "maximal configurability". Build a **fixed core plus a few configurable building blocks for each project, set up from presets**. The evidence is consistent: most people never change defaults, and the main barrier is time, not missing options. Self-built structure often doesn't pay back its upkeep. But rigid tools really do lose people. The best study found 11 of 19 people gave up on task apps for paper or docs because the apps didn't fit their work. The way through: let each project choose its **item types** (each mapped to a fixed base: task or event), its **statuses** (named freely inside fixed categories), its **milestones**, and its **saved views**. Sections become one way to group a view instead of the only container. Ship presets (Simple, Software, Course, Writing, Pipeline) so nobody starts from a blank page. One part no rival can copy easily: item types feed time tracking, so "meetings took 6 h, features 9 h" comes for free. Linear, Notion and Todoist don't track time, so they can't show this.

## 1. What the evidence says

### 1.1 Configurability: defaults matter most, and time is the barrier

| Finding | Grade | Source |
|---|---|---|
| Most of 51 Unix users customized less than they could. Top barrier: **lack of time**. Triggers: noticing their own repetition, or annoyance | B | Mackay 1991, via Page et al. 1996 [secondary: chi1996.acm.org/proceedings/papers/Page, retrieved 2026-11-02] |
| 92% of 101 WordPerfect users customized something, mostly toolbars and preferences. Advice: "optimize default settings for casual users" | B | Page et al. 1996 [same] |
| Under 5% of several hundred Word users changed any setting. Programmers and designers often changed over 40% | C | Spool [secondary: archive.uie.com/brainsparks/2011/09/14, retrieved 2026-11-02] |
| Defaults decide outcomes: organ donors were 42% under opt-in vs 82% under opt-out (online experiment, 161 people) | A− | Johnson & Goldstein [secondary: decisionsciencenews.com/?p=4, retrieved 2026-11-02] |
| Each step up in tailoring power should cost only a little more learning ("gentle slope") | B | MacLean et al. 1990 [secondary: summary only] |
| A few technical users build customizations and others copy them, so support sharing | B | Mackay 1990 [secondary: academia.edu/96814888] |
| Task management fails mainly on **effort**, even for skilled people | B | Bellotti et al. 2004 [secondary: hci.stanford.edu, retrieved 2026-11-02] |
| Heavy email filers re-found messages **no better** than light filers (345 users) | B | Whittaker et al. 2011 [secondary: research.ibm.com, retrieved 2026-11-02] |
| Counterpoint: people prefer browsing folders they built themselves over search | B | Bergman et al. [secondary: cordis.europa.eu/project/id/248997] |
| Intercom's first flexible version was "too flexible", so now "we express our opinions through defaults, templates, and education, rather than restrictions" | C | [secondary: intercom.com/blog/intercom-product-principles-opinionated-by-default-flexible-under-hood, retrieved 2026-11-02] |
| Notion setups get dropped at about 2 weeks; "setting the whole thing up" slows people down | D | [anecdote: thatvibecoders-newsletter.beehiiv.com; medium.com/@SuzaanSayed] |

**The strongest case for flexibility:** 11 of 19 people in an academic setting were "DIYers" using paper or Word docs, and 5 of them settled there after trying several task apps. Their reasons: the apps didn't fit, the learning curves were steep, and each new tool meant relearning [secondary: Haraty et al., GI 2012, cs.ubc.ca/~joanna/papers/GI2012_Haraty.pdf, read in full]. Only 14% of to-dos were kept in a list, and strategies were "closely tied with the demands of the participants' particular job pressures" [secondary: Bellotti CHI 2004]. Note that the DIYers picked a **flexible medium with no schema**, not a deep settings panel.

**Interpretation.** You (a programmer) are in the heavy-customizer minority [estimate: from the Spool and Mackay patterns]. Build what you want to configure, but every user must also be fine without touching it.

### 1.2 Project types share most of their building blocks

| Type | Item kinds | Lifecycle | Time-bound / recurring | Views | Progress means |
|---|---|---|---|---|---|
| Software | feature, bug, chore, idea, PR review, meeting/1:1, standup | backlog → todo → doing → (review) → done | meetings, standups, release dates | board, list, daily log | release shipped; work log for 1:1s |
| Study | lecture, reading, assignment, problem set, exam, study session, flashcard review | assigned → doing → submitted; topic: not started → studied → reviewed | lectures, labs, exams; syllabus deadlines | week calendar, deadline table, page per course | syllabus coverage, **hours per subject**, exam countdown |
| Thesis / writing | chapter, source, experiment, supervisor meeting | outline → draft → revise → submitted | supervisor meetings, milestones | chapter status table, timeline | word count vs target |
| Job search | application, contact, interview, follow-up | saved → applied → screen → interview → offer / rejected | interviews; follow-up N days after last action | pipeline board | funnel counts, next action per lead |
| Content | idea, script, video/post, sponsor deadline | idea → script → record → edit → publish | filming and publish dates | stage board + calendar | published on schedule |

Sources: [anecdote: news.ycombinator.com/item?id=40742831; dev.to/ml318097; forum.obsidian.md/t/32049] · [secondary: todoist.com/inspiration/todoist-guide-for-students, retrieved 2026-11-02] · thesis, job and content rows come from template sellers and vendors, so they show what people buy, not proven pains.

**Shared by every type** [estimate, synthesis]: actionable tasks, **time-bound events**, recurrence, ordered stages, a "kind" inside the project, dated milestones, tracked time, periodic review, a done log.
**Truly type-specific** [estimate]: a numeric target (word count), "days since last action" (pipelines), exam → prep tasks counted back from a date, links to an external tracker (GitHub/Jira), and spaced-repetition dates.

Pains worth noting:
- Solo devs find team tools too heavy and drift back to `TODO.md` with "Backlog / Bugs / Now" sections [anecdote: HN 40742831].
- Students measure **hours per subject**, not checkboxes [secondary, vendor pages: Korean timer apps].
- Nobody integrates spaced repetition with a planner [secondary: no result found].

### 1.3 Tools converge on the same few building blocks

| Pattern | Who | Fit for us |
|---|---|---|
| **Fixed status categories, user-named statuses inside them** (Backlog, Todo, In Progress, Done, Canceled) | Linear | High: Day, review and stats keep working whatever the names are |
| **Item type** as a single-select with icon, default fields and template | Linear label groups, ClickUp, Plane, Anytype | High |
| **A fixed base kind under every user type**: Tana maps user tags onto 13 base tags (Task, Meeting, Event, Project…) | Tana | High: this is how "meeting" and "feature" get different treatment on the calendar |
| **Groupings are views, not containers**; an item can be in several groupings | Plane modules, Obsidian Bases | High: this fixes "sections aren't overarching" |
| **Per-project feature switches, off by default** (Plane: cycles, modules, intake) | Plane, Amazing Marvin "strategies" | High |
| "Too many types leads to a complex system", so start broad and use templates for nuance | Anytype docs | Guardrail |
| Statuses belong to a location, not a type, and users ask for per-type statuses | ClickUp | Warning: keep statuses per project, not per type |
| Events count as work only once you claim them; a scheduled task looks different from an event; no duplicate task + event | Sunsama, Morgen, Akiflow complaints | High |

Sources: linear.app/docs/issue-property · outliner.tana.inc/learn/features/supertags · docs.plane.so/introduction/core-concepts · doc.anytype.io · feedback.clickup.com/feature-requests/p/statuses-by-task-type · help.sunsama.com/docs/tasks-vs-events-basics · morgen.so/guides/tasks-and-time-blocking-03 [all secondary, retrieved 2026-11-02]. Todoist caps sections at 20 per project, and sections can't carry labels or priorities [secondary: todoist.com help].

## 2. What skkil time has today

Task = one type, done or not done, project + one section + parent [measured: `tasks.rs`]. No item types, no workflow statuses, no events (a meeting can only be a time block on a task), no milestones, one view setting per project (`list`/`board`). Project-level settings (kind, status, weekly target, review cadence) already exist [measured: `projects.rs`].

## 3. Proposed model

```mermaid
flowchart LR
  subgraph Fixed core
    BK[Base kind: task · event]
    SC[Status category: backlog · todo · active · done · dropped]
  end
  subgraph Per project, from a preset
    T[Item types] --> BK
    S[Statuses] --> SC
    M[Milestones]
    V[Saved views: list · board · calendar · table, group by type/status/milestone/section]
  end
  I[Item] --> T & S & M
```

**Fixed (never configurable):**
1. **Base kind** of every item: **task** (do it, check it off) or **event** (happens at a time: meeting, lecture, exam, interview). Events sit on the Week grid as fixed anchors, appear on Day's timeline, never count as "tasks done", and can count their duration as tracked time. Recurrence works for both.
2. **Status categories**: backlog, todo, active, done, dropped. Day, Upcoming, Clear the deck and Reports read only categories. Example: backlog items never go overdue.

**Configured per project (four building blocks):**
1. **Item types**: name, icon, base kind, default duration, default checklist/notes template. Example for software: Feature, Bug, Chore, PR review, Meeting (event), Standup (event, recurring). For study: Lecture (event), Reading, Assignment, Problem set, Exam (event), Study session. Default "Simple" preset: one type, Task.
2. **Statuses**: user-named, ordered, each in one category. Simple: To do, Done. Software: Backlog, Todo, In progress, In review, Done.
3. **Milestones**: a named, dated group (release 0.3, Midterm, Chapter 2) that items join. Optional; off in Simple.
4. **Saved views**: layout (list, board, calendar, table) + group by (section, type, status, milestone, date) + filter + sort. Sections stay as manual groups for people who like them.

**Presets**: Simple (today's behaviour), Software, Course, Writing, Pipeline. Pick one at project creation and change any part later. Export and import a preset as a file, so a few builders can serve everyone else [secondary: Mackay 1990].

**Not in v1, on purpose:**
- **Custom fields.** The evidence warns against schema at entry time. Revisit the two real needs found: a number target for writing, and "days since last action" for pipelines, which can be derived from activity.
- **Per-type statuses.**
- **Automation.**
- **Cross-project custom types.**

**Gentle slope:** Simple projects look exactly like today. Types, statuses, milestones and views each appear only when switched on in project settings, or when a preset turns them on. Later (P2): suggest structure at the moment of friction, e.g. "5 tasks start with 'Bug:', make Bug a type?" [secondary: Mackay triggers].

**How it feeds the rest of the app:**
- Week grid: events show as solid anchors and blocks as tinted bars, never duplicated.
- Week N report: time by type ("Meetings 6 h · Features 9 h").
- Weekly review: Clear the deck reads status categories.
- Day: events become timeline anchors.

## 4. Market-value test

| | Answer |
|---|---|
| Who gains | Self-directed people running different kinds of projects at once: devs (work + side projects), students (courses + projects), with the founder first |
| How much | Replaces a Todoist + Notion + Jira/Linear + calendar stack for those users [assumption: to validate in 5 interviews]. Size of the pain not measured |
| Why now | Rivals split: Linear and Jira are opinionated and team-shaped, Notion, Tana and Capacities are flexible but costly to set up [anecdote: G2/blog reviews]. No personal tool combines types with time tracking |
| Why us | Types connect to time blocks, tracked time and weekly review, which Linear, Notion and Todoist don't have |
| Replaces | Todoist sections, Notion databases, personal Jira boards, `TODO.md` |
| Cost | New tables (item type, status, milestone, saved view), task gains type/status/start-end, migration of done → status. [Jennifer's guess: L; Emil to size] Competes with spec-organize for time |
| Risk | Configuration UI grows into ClickUp ("overwhelming for new users" [anecdote: G2, Capterra reviews]). Guardrail: Simple preset must stay unchanged; any settings screen under one entry point |

## 5. Decisions for you

1. **Fixed core + four building blocks per project + presets**, instead of maximal configurability (no custom fields in v1)?
2. **Events as a base kind of item** inside projects, rather than a separate calendar entity?
3. **Order**: build spec-organize first, then this? My recommendation: yes, because this change touches the task model that Day, Week and Reports read.

Before a big build, check this with 5 real people (2 devs, 2 students, 1 writer): show the presets and ask how they'd set up their current projects. Simulated interviews can sharpen the guide but can't replace this.

## 6. Gaps

- No first-hand Reddit evidence: the fetch was blocked. Sentiment comes from review sites, HN and blogs, with no counts.
- The customization research dates from 1990 to 2012 and covers office software. No study links planner configurability to retention.
- The Mackay 1991 and MacLean 1990 originals weren't readable, so those claims rest on summaries.
- Life admin and health weren't researched. Notion's Projects & Tasks template, Notion Calendar and TickTick weren't reviewed.
- No data on how often solo devs actually separate meetings, bugs and features in a personal tool. HN replies suggest most use a few sections.
