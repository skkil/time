# skkil-time (working name; folder: personal-time) · PRODUCT.md

_Updated 2026-11-02 · Stage: idea / pre-validation · **Current specs: spec-v1-2026-10-23.md; shell: spec-simple-shell-2026-11-01.md (built); IA: spec-organize-2026-11-02.md (ready to build)**_

- **Owner context:** solo developer, side project, side-income goal; global English-speaking market first; founder uses Linux.
- **Job (2026-10-23):** "Let me plan my week in time, then show me honestly what I and my agents actually shipped versus what I intended, without timers and without my data leaving my devices."
- **Product shape (2026-10-23):** unified Plan → Do → Capture → Review loop: tasks + weekly outcomes + time blocking + passive capture + agent-session awareness + local MCP. "A planner that checks itself."
- **Founder thesis (tested 2026-10-23):** AI makes people feel productive without shipping. Evidence: perception gap and activity inflation supported; "did nothing but prompt" false on average. Product = honest mirror, not anti-AI.
- **Beachhead (proposed 2026-10-18, not yet decided):** AI-assisted solo builders running parallel agent sessions (Claude Code, Codex, Cursor). Then general self-directed desk workers; then adults with ADHD. See addendum-ai-builders-2026-10-18.md.
- **Positioning (hypothesis):** desktop-first, private, automatic intention-vs-reality tracker; awareness before blocking; forgiving companion layer.
- **Market value definition:** revenue; target $1K MRR then $3K MRR.
- **Strategy:** strategy-2026-10-18.md · Evidence: ../../research/2026-10-18-personal-time-market-scan.md

## Decisions
- 2026-10-23 (founder): unify planner (tasks, time blocking, weekly review) with the tracker; tracker becomes the "reality" layer. See decisions/2026-10-23-unified-scope.md.
- 2026-10-23 (founder): agents = measure attention across agent sessions + agents can use the app (MCP). Built-in AI assistant not selected.
- 2026-10-23 (founder): planner is required; companion-to-Sunsama option rejected. Sunsama = benchmark to beat (parity list + M1/M2/M3 order in REEVALUATION-SUNSAMA.md). Notion is not an integration target.
- 2026-11-01 (founder): Review redesign: three rituals (inline day check-in on Today, guided weekly review ending in next week's plan, quarter built from outcomes); tasks link to outcomes; no "Close day" concept. See spec-review-2026-11-01.md.
- 2026-11-01 (founder): simplify the shell. Main page = Day/Week toggle (top centre); Day shows the running task (timer on) or today's outline; Week shows the timetable. Time, Habits, Review fold into one "Reports" page (full page, calming visual, not corporate). Projects open from a button (drawer, TBD); per-project configuration wanted (research pass). Future tasks added from a separate button/panel. Labels dropped entirely. Zen mode with full WebGL water backdrop, built in small steps. Review mode becomes configurable rituals (morning, evening, sleep, weekly, per-task after-session review); detailed plan required before implementation. Design pass (Rebecca) later.
- (pending founder, 2026-11-01) usability pivot: Today as the single daily screen with a "Plan today" step; "Clear the deck" replaces the review's "The week" step; outcome carry limit of 2; habits move from streaks to "x of last 14 days" plus skip days. See research/2026-11-01-usable-flow-synthesis.md.
- 2026-11-02 (founder): IA "plan where you live, look back by period" approved, all three parts incl. habit setup from Week's habit row. Spec: spec-organize-2026-11-02.md. Day/Week carry plan + doing (outcomes, habits, quarter line on Week; habits logged on Day). Reports becomes read-only and organized by period (Week N page, Quarter page) instead of tabs by data type (Time/Habits/Reviews). Rituals are the only bridge between horizons.
- 2026-11-02 (founder): approved all three: project task model = fixed core (base kind task/event, 5 status categories) + per-project item types, statuses, milestones, saved views, set up from presets (Simple, Software, Course, Writing, Pipeline); no custom fields in v1; build after spec-organize. See research/2026-11-02-project-task-structure.md; design brief: design-brief-2026-11-02.md.
- (pending founder) beachhead = AI-assisted solo builders; desktop-first; freemium with paid sync; ~$10/mo Plus.

## Assumptions to validate
0. Seeing your own multi-agent attention data (return latency, wait drift, unreviewed age) changes behaviour (self-instrumentation, 2 weeks).
1. Laptop drift is a felt pain for the beachhead (interviews, 6/10 bar).
2. A 60-second evening review keeps people coming back past week 2 (own-use prototype).
3. 300+ waitlist signups from organic channels in 4 weeks; 20+ paid/deposit commitments.

## Assumptions added 2026-10-23
4. Users will give agent drafts a human verdict instead of ignoring the Review inbox.
5. Felt-before-data rating is kept up (≥5 ratings/2 weeks) and the felt-vs-shipped gap narrows.
6. Honest numbers don't trigger a shame-quit (guardrail EVT-07 <15%).

## Tried and rejected
- "Close day" as an explicit action (button + modal on the weekly page): founder finds it unintuitive; days end on their own, check-in is optional and inline. 2026-11-01.
- Companion/reality layer on top of Sunsama or other planners (no own planner): founder requires the planner. 2026-10-23.
- Freelancer/billable tracking: founder explicitly rejects billable-client UI; crowded (Toggl, Clockify, Rize). 2026-10-18.
- Phone-first blocker: commoditized (free ScreenZen), bypassable, iOS API lock-in. 2026-10-18.
- Standalone agent orchestrator/notifier: crowded and platform-owned (Claude Code Projects, Codex app, Cursor 3, GitHub mission control, Warp, Conductor). 2026-10-18.
- Korean student study-timer market as primary: YPT/열품타 home turf. 2026-10-18.
- AI auto-scheduling of the user's day (Motion/Reclaim style): unwanted-AI complaints (16% of 1-2★), plan must be the user's own, incumbents moved to teams. 2026-10-23.
- In-app AI assistant for v1: bring-your-own AI via MCP instead (no model cost, beachhead already pays for AI). 2026-10-23.
- MCP server as the differentiator: table stakes (Todoist, Sunsama, Akiflow, Amie, Notion, Rize...). Kept, but not the wedge. 2026-10-23.

## Founder's current setup (2026-10-23, from screenshots)
Notion (quarter page, 3 yearly priorities, weekly pages: priorities, 1% improvement, daily 朝/午/夜 plan + 省 line, habit O/X grid, 3 reflection questions, weekly Focused Time hours) + Todoist (timed "Blocks" filter, recurring classes, deadlines, projects by course) + Clockify (manual timer by course, quarter tag) + Opal (phone blocking). No agent tracking. Dogfood bar: stop opening Clockify; Notion week page needs no manual edit. See IMPROVEMENTS.md §6.
