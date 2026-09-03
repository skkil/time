# DESIGN.md · skkil time

Design memory. Read before designing; update when a durable decision changes. Source spec: `.jennifer/products/personal-time/spec-v1-2026-10-23.md`.

## 1. Product truth
- **What it is:** a planner that checks itself. Plan the week as ≤3 outcomes and the day as time blocks; capture what actually happened (desktop, browser, agent sessions) without timers; compare plan with verified results.
- **Scene:** Min, an AI-assisted solo builder at a Linux or macOS desk, 2-3 Claude Code terminals open (dark) beside the app. Plans Monday morning, closes the day around 18:00. Desk light, long sessions, glances at the tray between tasks.
- **Job:** When I plan and run my day with agents, I want to see what I meant to do next to what I and my agents verifiably shipped, so I stop fooling myself.
- **Promise per surface:** Today: "every task has a when." Focus: "one thing, agents wait." Review inbox: "nothing an agent did counts until you say so." Day check-in (inline on Today, optional): "felt first, then reality." Week review: "next week's plan, built from data."
- **Proof we have:** none yet (pre-validation). All numbers in mocks are sample data and are labelled as such.
- **Claims we must NOT make:** efficacy claims for time blocking/weekly reviews; anything that reads as reading prompts or agent output (POL-PRIV-02); comparisons with other people.
- **Category default:** Todoist/Sunsama-style soft pastel lists + Rize-style dashboards of activity scores. **Predictable opposite:** dark hacker terminal aesthetic. Both rejected.

## 2. Direction contract (locked 2026-10-23)
- **Name:** Departure board, with agent lines (roll seed 025c20089802ae22, C + B mix).
- **THESIS:** a plan is a timetable; reality is what actually departed. Every block reads *scheduled · actual · status*. Refuses the activity-score dashboard.
- **OWN-WORLD:** pale stone ground, graphite ink, tabular figures in fixed columns, status cells (dark graphite cells with light text, like board cells), one transit blue for "on time / now / focus", one amber for "moved / attention". Agent sessions are drawn as thin transit lines with station dots for waits.
- **STORY:** Plan (Today, Board) → Do (Focus, tray) → Verify (Review inbox) → Review (day check-in, guided week review) → next plan.
- **FIRST VIEWPORT (Today):** left nav 216px; center is the day as a ledger (Scheduled · Actual · Block · Status, one row per block, every row has a status incl. Scheduled/Now); the live Supervise row carries the agent hairlines; free time is a dashed drop row. Right 400px rail: capture field, triggers, backlog outcomes-first; the "When will you do this?" picker expands inline under the task. The calendar grid lives behind the Day/Week toggle.
- **SIGNATURE MOMENT:** Day check-in (was Day close, removed 2026-11-01; the flip reveal is not built yet). After the felt rating, the status cells flip from "Scheduled" to their actual status, one row after another (60 ms stagger, 240 ms each). Reduced motion: shows end state instantly.
- **WHAT WE SAID NO TO:** gradients, glows, glass, scores/grades, streak flames, confetti, emoji, mascot (companion layer is P2), cream + serif, mono-as-costume, colored left borders on cards, red for "lost" (shame risk: lost is neutral + dashed).

## 3. Tokens
### Color (Assembly manual, chosen 2026-11-01; contrast checked with palette.py)
Brick primaries on paper. Each colour has exactly one job, so red never means "now".
| token | light | dark | role | contrast (text on ground) |
|---|---|---|---|---|
| ground | #F5F5F2 | #17191E | app background | |
| surface | #FFFFFF | #20232A | panels, cards | |
| line | #E1E1DC | #2F333C | 1px dividers | |
| ink | #161616 | #F1F1EE | text | 16.6 / 15.5 |
| ink-2 | #5F5F5A | #A6A8AE | secondary text | 5.9 / 7.4 |
| blue (primary, now) | #0057B8 | #5C9DFF | actions, focus, now line, active nav, selected | 6.3 / 6.5; white on blue 6.9, dark on blue 6.5 |
| yellow (today) | #E8B400 | #FFD23F | today only: today column/date, current week cell | ink on yellow 9.4 |
| red (urgent) | #C8201A | #FF6B5E | P1, overdue, destructive only | 5.2 / 6.3 |
Projects use the brick set (blue, red, amber, green, teal, plum, olive, graphite). Planner blocks: project tint fill + 3px solid project edge.

Status set: On time (blue tint) · Now (blue fill) · Scheduled (outline) · Moved / Cut short (graphite tint) · Elsewhere (dashed) · Not captured (hatched) · Calendar (plain). Status never by color alone: every status has a word, and lost/not-captured also differ by border style (dashed / hatched).

### Type
| role | family | weights | why |
|---|---|---|---|
| everything (display, text, numbers) | Hanken Grotesk Variable | 400–700 | one family; sturdy grotesk with clear figures |
Numbers use the same face with tabular figures (`font-variant-numeric: tabular-nums` on `html`), so columns align without a monospace face. No `font-mono` for times or counts (founder: "why do numbers have a different font"). `font-mono` is only for raw error text. Hangul falls back to Pretendard.

### Shape, space, depth, motion
- Spacing: 4, 8, 12, 16, 24, 32, 48.
- Radius: 4 (chips, inputs, status cells) · 6 (rows, blocks, cards) · 10 (popovers, sheets, phone cards).
- Selected state (everywhere): 2px graphite inset outline on white. Never the primary-button fill.
- Elevation: only popovers and tray menus (`0 8px 24px rgba(26,29,33,.14)`); everything else flat with 1px lines.
- Motion: micro 120ms, small 200ms, medium 320ms; ease `cubic-bezier(.16,1,.3,1)`; no ambient motion; the flip reveal is the only orchestrated moment.
- Icons: inline 1.5px stroke, 16/20px, round caps.

## 4. Assets
Brand marks in `assets/` (code-drawn SVG). None generated. All visuals are code-drawn (timeline, agent lines, charts). Spend: $0.

## 5. Voice
Warm host, plain engineer. Second person, short, numbers with units. Never grades the user. "Rough day. Here's what still shipped." Words we use: block, outcome, draft, verdict, verified, drift, held. Words we never use: productivity score, streak, crush, hustle, seamless.

## 6. Platform notes
- Desktop (Tauri, Linux/macOS): dense, keyboard-first (shortcuts shown in tooltips/menus), tray/menu-bar item is a first-class surface.
- Mobile companion (P2): Today, capture, Review inbox only. 44px targets, bottom tabs.

## 7. Allowances
See `.design/slop-allow.json`: cream-ground (it's the amber status tint, not a ground) and three-up-grid (3 outcomes / 3 verdicts / 3 draft facts are product rules).

## 8. Decision log
- 2026-10-23: v1.1 pass from IMPROVEMENTS.md + REEVALUATION-SUNSAMA.md. Board cut (nav is now Today, Plan the week, Review inbox, Close the day, Weekly review, Settings; Today shows delegated/draft counts). New: first run (4 steps, step 4 = last 7 days from ActivityWatch + git, reality only), guided Plan the day, Plan the week (quarter priorities, 13-week focused-hours strip, Due/Morning/Afternoon/Evening grid), Capture from anywhere (CLI, /skkil, hotkey), dark Today. Weeks are "Q4 · Week N", not ISO. Rough parts of the day are a valid "when" for any task. Drafts come only from mark_draft_ready or /skkil done; a quiet session is "Probably done?" (dashed, separate group). Drafts show git metadata + Open PR. Weekly review leads with focused hours, then one pattern + one chosen experiment; metrics sit under Details. Day close adds offline-focus confirm, unassigned time, habits (yes/no, no streaks), one line per day; carry-overs are suggestions with Keep. Hard block is opt-in. Close-the-day reminder defaults to after the last block. Codex/Cursor free.
- 2026-10-23: Critic round 1 (5.5/10: "departure board lives in one table, not the system"). Today rebuilt as the ledger; agent lines moved into the Supervise row; KPI tiles cut to a sentence (Day close) and a ledger table (Week); chips reduced to outcome text + agent glyph; amber restricted to needs-you-now; "Lost" renamed "Elsewhere"; one selected style; Board tubs removed; narration copy cut ~80%; logo became a split-flap cell.
- 2026-10-23: Direction C (departure board) + B's agent lines for agent sessions. User: "don't make the design too flashy … simple and minimal… unifying todoist + toggl + forest + opal + jira." Split-flap reduced to static status cells + one reveal on day close.
- 2026-10-23: Felt rating is one tap that auto-advances (answers OQ-3).
- 2026-10-23: Draft detail shows only metadata + the user's expected result, never agent output (POL-PRIV-02); "Open session" hands off to the user's terminal/editor.
- 2026-11-01: Desktop app rebuilt (Tauri 2 + React 19, shadcn/ui radix-nova + Tailwind v4, tauri-specta bindings). IA: Planner (Schedule = time-blocking grid with a tracked-time strip per day, Board = tasks by due day), Inbox, Today, Projects (nested, max depth 3), Time (Clockify-style timer bar + entry log, by-project roll-up), Habits (12-week grid, done/missed/none), Review (quarter strip, outcomes, days ledger, notes; M0 pages folded in). Eight muted project colours via `--project-*`; block tint 14%/38% light, 24%/45% dark. Selected state everywhere = 2px inset foreground outline. Meta lines are spaced stats with mono values, not middot chains. Timer is in-memory only (user: "doesn't have to be persistent for now").
- 2026-11-01: Todoist parity pass (user: "major replacement for Todoist"). Today is home. Sidebar order: Add task (Q), Search (Ctrl K), Inbox, Today, Upcoming, then Planner/Time/Habits/Review, Projects, Labels. Rows: priority-ringed round checkbox, title, first line of description, meta line (sub-task count, date, deadline, time, labels), placement right-aligned; hover actions overlay instead of reserving width. Priority colours are new tokens `--p1` red, `--p2` orange, `--p3` blue; due dates: overdue `--p1`, today `--due-today` green, this week `--p2`. Quick-add tokens highlight in `--now-tint`. Add affordances use `--now`, not red, so red keeps meaning "P1/overdue". Upcoming starts at today (not ISO week). Planner's Board view removed: Upcoming covers tasks-by-day.
- 2026-11-01: Habits follow Habitify: a Today journal grouped by time of day,
  with bad habits in their own group, plus a week grid. Bad habits are Quit or
  Limit and show "Clean for …" instead of a goal. Status colours reuse the task
  tokens: `--due-today` green for done, `--p1` red for failed. Auto-tracked
  habits are marked "auto"; hand-set days get a small dot.
- 2026-11-01: Name is "skkil time" (org lockup convention: lowercase, space, no hyphen). App icon `assets/icon.svg` is the split-flap cell: graphite lower flap, lighter upper flap, gap, hinge pins, one transit-blue block. Lockups generated with the org `logo/lockups/lockup.py` into `assets/`. Icons regenerate with `skkil assets generate`; small sizes use inset 80. `.icns` comes from `pnpm tauri icon` (skkil has no icns output).
- 2026-11-01: "Close day" removed (founder: unintuitive). Day check-in is an inline row on Today from 17:00 or after the last block; yesterday's shows until noon if unrated; Skip is remembered. Review tab is a home (one review prompt, this week's outcomes with linked-task evidence, quarter panel with 13 outcome cells, past weeks) plus a 6-step guided weekly review (Feel → Outcomes → The week → Reflect → Plan next week → Done; Quarter wrap-up in week 13). Shared pieces: `FeltScale`, `StepIndicator`. Spec: spec-review-2026-11-01.md.
- 2026-11-01: Restyle. Founder: palette "too bland", font "really bad", numbers in a different font. Rolled 3 directions (seed 18f091317d28cdc8; frames in `.design/restyle/`); founder picked C, Assembly manual, over my recommendation B (Night departures). Red Hat Display/Text/Mono replaced by Hanken Grotesk; all `font-mono` on numbers removed; colour roles split: blue = action/now, yellow = today, red = urgent.
