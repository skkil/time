# DESIGN.md · skkil time

Design memory. Read before designing; update when a durable decision changes. Source spec: `.jennifer/products/personal-time/spec-v1-2026-10-23.md`.

## 1. Product truth
- **What it is:** a planner that checks itself. Plan the week as ≤3 outcomes and the day as time blocks; capture what actually happened (desktop, browser, agent sessions) without timers; compare plan with verified results.
- **Scene:** Min, an AI-assisted solo builder at a Linux or macOS desk, 2-3 Claude Code terminals open (dark) beside the app. Plans Monday morning, closes the day around 18:00. Desk light, long sessions, glances at the tray between tasks.
- **Job:** When I plan and run my day with agents, I want to see what I meant to do next to what I and my agents verifiably shipped, so I stop fooling myself.
- **Promise per surface:** Day: "where you are now, with your fixed points marked." Week: "your week on one screen: what matters, and when you'll do it." Projects: "each project works the way that kind of work works, without building a system first." Reports: "your weeks, as they actually went. Read, don't manage." Check out: "close the day, then let it go."
- **Proof we have:** none yet (pre-validation). All numbers in mocks are sample data and are labelled as such.
- **Claims we must NOT make:** efficacy claims for time blocking/weekly reviews; anything that reads as reading prompts or agent output (POL-PRIV-02); comparisons with other people.
- **Category default:** Todoist/Sunsama-style soft pastel lists + Rize-style dashboards of activity scores. **Predictable opposite:** dark hacker terminal aesthetic. Both rejected.

## 2. Direction contract (locked 2026-11-02, supersedes the departure board)
- **Name:** Calm canvas.
- **THESIS:** one open canvas on a sky that follows the time of day, with frosted glass only where something is held (a task, a window, a board column). Minimal information at a time; calm and capable, never managed, graded or behind. Refuses the boxed Todoist list and the activity-score dashboard.
- **OWN-WORLD:** a code-drawn sky (linear gradient plus four slow radial glows, stops at 0/5/8/13/17/19.5/22 h, blended with smoothstep in `features/zen/sky.ts`); type and spacing sit directly on it; white ink at stepped opacities; Apple-style glass for panels. No image or video assets in the app; the only video-like asset is the Check out ocean (animated WebP), used nowhere else.
- **STORY:** Day (do) → Check out (close the day) → Week (plan the week: outcomes, quarter, habits, project hours over the grid) → weekly review → Reports (read back by week and quarter). Projects is the one denser workspace, still on the canvas.
- **FIRST VIEWPORT (Day):** top-left profile circle (menu: Add, Search, Reports, Settings), top-centre Day · Week · Projects pill. Left column: weekday in light 48px, date · weather, habit dots, then a vertical timeline (tasks as circles, events as small diamonds), Check out at the bottom. Right: the focused task in one glass panel, edited in place.
- **SIGNATURE MOMENT:** Check out: a full-screen ocean scene behind a frosted box you can almost, but not quite, read through.
- **WHAT WE SAID NO TO:** boxes and cards as layout, top bar + drawer chrome, side sheets for tasks (a centred glass window instead), coloured priority rings, icon rows on task rows, streaks, scores, grades, percentages of progress, rankings, red overdue counts, confetti, emoji.

## 3. Tokens
### Color (dark only; `syncColorScheme` always adds `.dark`)
| token | value | role |
|---|---|---|
| background | #0B1220 | under the sky, never seen for long |
| foreground | #F1F1EE | ink; secondary text is `foreground/45–60`, faint hints `/25–35` |
| card | white 5% | in-flow glass |
| popover | rgba(14,22,36,.90) + `backdrop-blur-2xl backdrop-saturate-150` | menus, popovers, dialogs |
| border / input | white 12% / 14% | hairlines |
| primary | white 90%, foreground #0B1A22 | the one filled pill per surface (Begin, Continue, Review) |
| accent / muted | white 9% / 7% | hover and selected fills |
| now-tint | white 12% | quick-add token highlight |
| project colours | `--project-*` (8) | dots, block tints, solid event fills; projects own colour, so item types get icons, not colours |
| p1 | #FF6B5E | urgent and destructive only |
Status is never colour alone: done is a filled circle with a check, rest is a dash, events are diamonds (Day) or solid blocks (grids), unreviewed is a word in muted text.

### Glass
- Task window: `rounded-[32px] bg-[rgba(10,18,32,.92)] ring-1 ring-white/10 backdrop-blur-2xl`, centred, 768px wide, ≤680px high.
- Day focus panel: `rounded-[32px] bg-[rgba(6,18,26,.38)] backdrop-blur-xl`.
- Quick add: one line, `rounded-[28px] bg-[rgba(10,22,34,.55)]`, top 22%.
- Workspace: glass only on board columns, calendar days and the table body (`bg-white/[.04] ring-white/[.07]`); everything else on the sky.
- WebKitGTK may render blur slowly or not at all: every glass surface must stay readable as plain translucency (the alphas above were chosen with blur off).

### Type
| role | family | weights | why |
|---|---|---|---|
| everything | Hanken Grotesk Variable | 200–600 | one family; light display sizes (36–48px, 200–300) carry the calm |
Tabular figures everywhere; Hangul falls back to Pretendard; no `font-mono` for numbers.

### Shape, space, depth, motion
- Spacing: 4, 8, 12, 16, 24, 32, 48, 64. Radius: full (pills, circles), 12–16 (rows, columns), 28–40 (glass windows).
- Motion: sky glows drift over 71–103 s, alternate, only when Background is "Moving"; entrances fade/slide 700–1000 ms with 60 ms stagger; state changes 300–500 ms. Reduced motion shows end states.
- Icons: lucide outline, 1.5 stroke. Item types use a curated set of 24 (`features/workflow/TypeIcon.tsx`).

## 4. Assets
Brand marks in `assets/` (code-drawn SVG). None generated. All visuals are code-drawn (timeline, agent lines, charts). Spend: $0.

## 5. Voice
Warm host, plain engineer. Second person, short, numbers with units. Never grades the user. "Rough day. Here's what still shipped." Words we use: block, outcome, draft, verdict, verified, drift, held. Words we never use: productivity score, streak, crush, hustle, seamless.

## 6. Platform notes
- Desktop (Tauri, Linux/macOS): dense, keyboard-first (shortcuts shown in tooltips/menus), tray/menu-bar item is a first-class surface.
- Mobile companion (P2): Today, capture, Review inbox only. 44px targets, bottom tabs.

## 7. Allowances
See `.design/slop-allow.json`: zen-backdrop (gradient + ambient shader, zen mode only), cream-ground (it's the amber status tint, not a ground) and three-up-grid (3 outcomes / 3 verdicts / 3 draft facts are product rules).

## 8. Decision log
- 2026-11-02: Calm canvas locked (brief: design-brief-2026-11-02.md). Week gets the plan strip (quarter line, outcomes, habits, project hours, review line) as type on the sky; Reports becomes an archive (weeks list, Week N, Quarter) on a fixed dusk sky; Projects gets presets (Simple, Software, Course, Writing, Pipeline), saved views (list, board, calendar, table) and events. R1–R5 defaults taken: glass only for dense containers, events solid / tasks tinted, type = icon only, collapsed habit and project rows, dusk sky for Reports. Habits and task windows are centred glass windows, not side sheets (founder: "a central modal feels more right, the sidebar panel seems very out-of-design"); project settings stays a side sheet.
- 2026-11-01: Simple shell (spec-simple-shell). Sidebar replaced by a top bar in dark green chrome (`--chrome` #183A2C light / #132A20 dark, `--chrome-foreground`, `--chrome-muted`, `--chrome-accent`); primary/now/focus moved from transit blue to green (#1F4D3A light, #7CC4A0 dark). User: "make them professional with a dark shade of green, the tasks themselves don't have to be themed, just the things around it". Task rows, priorities and project colours stay neutral and unchanged. Zen mode is the one place for atmosphere: a full-window backdrop (`--zen-sky/shallow/mid/deep`) with an original WebGL2 still-water shader over a static gradient fallback; user: "water only in zen … other zen themes (user configurable) like mountains or forests later". Ritual cards sit on `bg-card/95` above it. This supersedes "no gradients" and "no ambient motion" inside zen only.
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
