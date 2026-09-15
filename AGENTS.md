# AGENTS.md

skkil/time is a local-first personal planner: tasks, nested projects,
time-blocking, time tracking, habits, and a weekly/quarterly review. All data
lives in one SQLite file on the user's machine; there is no server and no sync.

Product docs live at the repo root (`IMPROVEMENTS.md`, `OPEN-LOOPS.md`,
`REEVALUATION-SUNSAMA.md`), the spec under `.jennifer/`, and the design
memory in `.design/DESIGN.md`.

## Domain model

- **Project** — nested (max depth 3) with a colour, a list/board view, an
  archived flag and settings: `group_id` (only top-level projects carry one and
  sub-projects follow it), `status`
  (active/paused/done/dropped; inactive ones leave Day and the drawer tree),
  weekly hours budget, target date, stop-if criteria, review cadence
  and `in_order`; archiving or deleting cascades to the subtree. There are no
  areas: ongoing work is a project without a target date. `NULL` project
  means Inbox.
- **Group** — a named set of top-level projects in `features/groups.rs`
  (table `project_group`, migrations 009 and 012); deleting one only clears
  it from its projects. The drawer lists top-level projects under their
  group; its heading opens the group overview (`/projects/groups/$groupId`,
  a timeline of every project's due dates, deadlines, milestones and
  target date, then one card per project). Each project also has a
  Timeline tab of its dated tasks (`projects/Timeline.tsx`).
- **Section** — ordered group inside a project (or the Inbox); deleting it
  deletes its tasks.
- **Task** — Todoist-shaped: title, description (`notes`), project, section,
  parent (sub-tasks inherit the parent's project/section), priority 1–4
  (1 = highest), due date + optional time, deadline, recurrence, duration
  (`estimate_minutes`), sibling `position`, `rollover_count` (bumped when a
  due task is pushed later), `someday`, `must_on` (≤3 musts per day) and a
  `next_step` resume note. Tasks can wait on other tasks
  (`task_dependency`, migration 010, `features/dependencies.rs`):
  `blocked_by` lists every link and `waiting_on` the still-open ones, so
  "blocked" is derived, never stored; loops, self-links and repeating or
  event blockers are refused. Completing a repeating
  task moves its date forward instead of closing it.
- **TimeBlock** — a planned span for a task on the schedule grid.
- **TimeEntry** — tracked time with optional project/task; a linked task
  decides the project. The running timer is one row in `running_timer`
  (migration 008), so it survives a restart; stopping turns it into an entry.
- **Habit / HabitLog** — Habitify-style habits: `build` (reach a daily goal),
  `quit` (none at all) or `limit` (at most a goal), in times or minutes, with
  repeat days, time of day, area and start date. A habit may have `tracking`
  (websites, apps, or a project's tracked time). `sync_habits` writes measured
  values as `auto` logs; a status the user sets by hand always wins. Daily
  status is derived in `habits::status`, never stored. Websites and apps are
  read from ActivityWatch (`SKKIL_ACTIVITYWATCH_URL`, default
  `http://localhost:5600`).
- **Ritual / RitualRun** — configurable routines in `features/rituals.rs`:
  morning, evening, wind_down, session (after a timer stops) and weekly. Each
  has one trigger (`first_open`, `at_time`, `end_of_day`,
  `after_timer_stop`, `manual`), weekdays (Monday = bit 0) and ordered steps
  from a closed library. `due_ritual(event)` decides what opens; a run fires
  once a day unless snoozed (15 min, once). The frontend shows rituals in a
  full-window zen overlay (`features/rituals`, backdrop in `features/zen`,
  WebGL2 water shader with a static fallback; themes carry their own shader).
- **Item type / Status / Milestone / Saved view** — per-project structure
  in `features/workflow.rs`. A type is a task or an **event** (happens at a
  time; never checked off; repeats expand into occurrences via
  `list_events`; may count as tracked time). Statuses are named freely, each
  in one fixed category (backlog, todo, active, done, dropped); a closed
  category and `completed_at` stay in step both ways, and backlog items never
  count as overdue. Presets (`workflow::presets`) set all four at once;
  Simple sets none, so a plain project looks as before. Moving a task between
  projects maps its type by name and its status by category.
- **Record** — a third type kind (migration 011, `features/records.rs`): a
  long-lived item with no checkbox whose status is its current **phase**
  (e.g. one job application per company). Its sub-tasks carry `phase_id`
  (a status of the same project); `record_phase` holds a note per phase,
  while the record's own notes are shared by every phase. Moving it maps
  phases by name. The task window pages phases in a vertical pager
  (`features/records/PhasePager.tsx`); records stay off Day, Week and the
  review deck, but their phase tasks are ordinary tasks.
- **Day / Week / Quarter** — a day note and felt rating written by rituals;
  weekly outcomes (≤3 open, linked to tasks via `task.outcome_id`, status
  open/achieved/carried/dropped; carried copies the outcome into next week
  with its open tasks, at most twice) and a guided weekly review (feel,
  outcomes, clear the deck, one change, plan, quarter wrap-up; progress in
  `week.step`, finished at `week.reviewed_at`); quarter priorities over 13
  weeks. Habits count "x of last 14 days" with planned rest days, no streaks.
  Specs: `.jennifer/products/personal-time/spec-review-2026-11-01.md` and
  `spec-simple-shell-2026-11-01.md`.

## Repository structure

Multi-app monorepo without a workspace manager:

- `apps/desktop/` - Tauri 2 desktop app (Rust backend + React frontend)

Each app is independent with its own package manager and build system.

`skkil.yml` wires the repo into the org CLI (`skkil`): `skkil dev`,
`skkil doctor`, `skkil ci` (format, lint, test, build for both the Rust core
and the frontend), and `skkil assets generate`, which renders every app icon
from `assets/icon.svg`. `icon.icns` is not covered by skkil; regenerate it with
`pnpm tauri icon` from a 1024px render of the same master.

## Desktop app (`apps/desktop/`)

```bash
cd apps/desktop
pnpm install
pnpm tauri dev     # run the app with hot reload
pnpm tauri build   # release bundle under src-tauri/target/release/bundle
pnpm compile       # tsc -b
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm test          # Vitest

cd src-tauri
cargo test
cargo clippy --all-targets
```

### Todoist parity

- Quick add parses `tomorrow 3pm`, `next fri`, `Nov 5`, `p1`–`p4`,
  `#Project`, `/Section`, `every …`, `{deadline}`, `for 1h` in
  `src/features/tasks/parse.ts` (tests beside it, `pnpm test`).
- Recurrence rules are parsed and advanced in `src-tauri/src/recurrence.rs`;
  keep the frontend phrases a subset of what it accepts.

### Backend (`src-tauri/`)

- One crate (`skkil-time`, lib `skkil_time_lib`), no workspace.
- `src/features/<domain>.rs` holds the types, queries, validation, Tauri
  commands and tests for one domain.
- `src/db/migrations/*.sql` are embedded and applied in order, versioned with
  `PRAGMA user_version`. Never edit a shipped migration; add a new one.
- The database is `<app data dir>/com.skkil.time/time.db`. Use a scratch
  `XDG_DATA_HOME` when testing so the real database is never touched.

### Frontend (`src/`)

- React 19 with React Compiler, TanStack Router (hash history) and TanStack
  Query, shadcn/ui (`src/components/ui`) on Tailwind v4, dnd-kit.
- `src/bindings.ts` is generated by tauri-specta on every debug run and by
  `cargo test`. Do not edit it; change the Rust types instead.
- `src/features/<domain>/api.ts` holds the queries and mutations for a domain;
  components live beside it.
- Keyboard shortcuts go through `useShortcuts` (`src/lib/shortcuts.ts`);
  per-device UI preferences through `src/lib/preferences.ts`. New settings
  are a section in `features/settings/SettingsDialog.tsx` built from
  `SettingRow`.
- Imports use `@/` instead of parent-relative `../` (enforced by ESLint).
- Routes: `/?view=day|week&week=` (`week` is a Monday date key),
  `/projects`, `/projects/someday`, `/projects/$projectId`,
  `/projects/groups/$groupId`, `/review/$week`
  (the first, guided review of a week). There is no Reports page: Week is
  the record. A past week swaps the task rail for its reflection, and a
  reviewed week is edited in `ReviewDialog`, never by reopening the guided
  review. All old `/reports/*`, `/time`, `/habits`, `/review`, `/inbox`,
  `/today`, `/upcoming`, `/someday`, `/planner` routes redirect.
- The Week grid fits 07:00–23:00 to the window (`fitHourHeight`); the hour
  scale is a context (`planner/scale.ts`), so read it with `usePerMinute`
  instead of a constant. Each day column holds planned blocks and events on
  the left and tracked time entries in a lane on the right.
- Habit auto-sync runs from the app shell (start, window focus at most every
  5 min) and when the Habits window opens.

## No root-level tooling

- No `pnpm-workspace.yaml` or root `package.json`
- No GitHub Actions workflows
- No shared ESLint, TypeScript, or prettier configs
- Each app is self-contained
