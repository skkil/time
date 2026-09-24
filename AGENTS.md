# AGENTS.md

skkil/time is a local-first personal planner: tasks, nested projects,
time-blocking, time tracking, habits, and a weekly/quarterly review. All data
lives in one SQLite file on the user's machine; there is no server and no sync.

Product docs live at the repo root (`IMPROVEMENTS.md`, `OPEN-LOOPS.md`,
`REEVALUATION-SUNSAMA.md`), the spec under `.jennifer/`, and the design memory
in `.design/DESIGN.md`.

## Domain model

- **Project** — nested (max depth 3) with a colour, a list/board view, an
  archived flag and settings: `group_id` (only top-level projects carry one and
  sub-projects follow it), `status` (active/paused/done/dropped; inactive ones
  leave Day and the drawer tree), weekly hours budget, target date, stop-if
  criteria, review cadence and `in_order`; archiving or deleting cascades to the
  subtree. There are no areas: ongoing work is a project without a target date.
  `NULL` project means Inbox.
- **Group** — a named set of top-level projects in `features/groups.rs` (table
  `project_group`, migrations 009 and 012); deleting one only clears it from its
  projects. The drawer lists top-level projects under their group; its heading
  opens the group overview (`/projects/groups/$groupId`, a timeline of every
  project's due dates, deadlines, milestones and target date, then one card per
  project). Each project also has a Timeline layout of its dated tasks
  (`projects/Timeline.tsx`).
- **Canvas** — one free-form document per project (`project_canvas`, migration
  013, `features/canvas.rs`), stored as HTML from the Tiptap editor in
  `projects/ProjectCanvas.tsx`; autosaves and goes with the project. Shown as
  the project's Notes tab, with its first lines in the side panel.
- **Section** — ordered group inside a project (or the Inbox); deleting it
  deletes its tasks.
- **Task** — Todoist-shaped: title, description (`notes`), project, section,
  parent (sub-tasks nest to any depth and inherit the parent's project/section;
  completing, moving or deleting reaches every level), priority 1–4 (1 =
  highest), due date + optional time, deadline, recurrence, duration
  (`estimate_minutes`), sibling `position`, `rollover_count` (bumped when a due
  task is pushed later), `someday`, `must_on` (≤3 musts per day) and a
  `next_step` resume note. Tasks can wait on other tasks (`task_dependency`,
  migration 010, `features/dependencies.rs`): `blocked_by` lists every link and
  `waiting_on` the still-open ones, so "blocked" is derived, never stored;
  loops, self-links and repeating or event blockers are refused. Completing a
  repeating task moves its date forward instead of closing it.
- **TimeBlock** — a planned span for a task on the schedule grid.
- **TimeEntry** — tracked time with optional project/task; a linked task decides
  the project. The running timer is one row in `running_timer` (migration 008),
  so it survives a restart; stopping turns it into an entry, and finishing a
  task stops a timer on it or anything nested under it. A break (migration 016)
  logs the stretch so far as an entry and sets `paused_at`; `banked_seconds`
  keeps the session total, and resuming starts a new stretch. `list_time_entries`
  returns every entry overlapping the range, so totals clip with
  `secondsWithin`. `list_task_entries` (with sub-tasks) and
  `list_project_entries` (with sub-projects, following a linked task's current
  project) return the whole history, shown as Focus in the task window and as a
  project's Focus tab. `list_tasks` leaves out tasks closed over two weeks ago,
  so `useTask` fetches those on demand.
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
  has one trigger (`first_open`, `at_time`, `end_of_day`, `after_timer_stop`,
  `manual`), weekdays (Monday = bit 0) and ordered steps from a closed library.
  `due_ritual(event)` decides what opens; a run fires once a day unless snoozed
  (15 min, once). The frontend shows rituals in a full-window zen overlay
  (`features/rituals`) over the same time-of-day sky as the app
  (`features/zen/ZenBackdrop.tsx`, deepened); there are no image assets.
- **Item type / Status / Milestone / Saved view** — per-project structure in
  `features/workflow.rs`. A type is a task or an **event** (happens at a time;
  never checked off; repeats expand into occurrences via `list_events`; may
  count as tracked time). Statuses are named freely, each in one fixed category
  (backlog, todo, active, done, dropped); a closed category and `completed_at`
  stay in step both ways, and backlog items never count as overdue. Presets
  (`workflow::presets`) set all four at once; Simple sets none, so a plain
  project looks as before. Moving a task between projects maps its type by name
  and its status by category.
- **Record** — a third type kind (migration 011, `features/records.rs`): a
  long-lived item with no checkbox whose status is its current **phase** (e.g.
  one job application per company). Its sub-tasks carry `phase_id` (a status of
  the same project); `record_phase` holds a note per phase, while the record's
  own notes are shared by every phase. Moving it maps phases by name. The task
  window pages phases in a vertical pager (`features/records/PhasePager.tsx`);
  records stay off Day, Week and the review deck, but their phase tasks are
  ordinary tasks.
- **Day / Week / Quarter** — a day note and felt rating written by rituals;
  weekly outcomes (≤3 open, linked to tasks via `task.outcome_id`, status
  open/achieved/carried/dropped; carried copies the outcome into next week with
  its open tasks, at most twice) and a guided weekly review (feel, outcomes,
  clear the deck, one change, plan, quarter wrap-up; progress in `week.step`,
  finished at `week.reviewed_at`); quarter priorities over 13 weeks. Habits
  count "x of last 14 days" with planned rest days, no streaks. Specs:
  `.jennifer/products/personal-time/spec-review-2026-11-01.md` and
  `spec-simple-shell-2026-11-01.md`.

## Repository structure

Multi-app monorepo without a workspace manager:

- `apps/desktop/` - Tauri 2 desktop app (Rust backend + React frontend)

Each app is independent with its own package manager and build system.

`skkil.yml` wires the repo into the org CLI (`skkil`): `skkil dev`,
`skkil doctor`, `skkil ci` (format, lint, test, build for both the Rust core and
the frontend), and `skkil assets generate`, which renders every app icon from
`assets/icon.svg`. `icon.icns` is not covered by skkil; regenerate it with
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

- Quick add follows Todoist's syntax: dates and times in plain words, `every …`
  repeats, `{deadline}`, `p1`–`p4`, `#Project`, `/Section`, `+type`, `for 1h`.
  It lives in `src/features/tasks/quick-add/`; each grammar in `parser/` is a
  rule table or pattern with tests beside it, and `parser/parse.ts` runs them in
  order. Clicking a highlighted phrase keeps it as plain text.
- Repeats are read, advanced and given their first date in
  `src-tauri/src/recurrence/`: rules in `rule.rs`, matchable days in
  `pattern.rs`, `every!` and end dates in `mod.rs`. The frontend only claims the
  phrase. `parser/repeat-phrases.json` is read by both test suites, so a phrase
  the backend can't store fails the build.

### Backend (`src-tauri/`)

- One crate (`skkil-time`, lib `skkil_time_lib`), no workspace.
- `src/features/<domain>.rs` holds the types, queries, validation, Tauri
  commands and tests for one domain.
- `src/db/migrations/*.sql` are embedded and applied in order, versioned with
  `PRAGMA user_version`. Never edit a shipped migration; add a new one.
- The database is `<app data dir>/com.skkil.time/time.db`. Use a scratch
  `XDG_DATA_HOME` when testing so the real database is never touched.
- Settings → Data exports with `VACUUM INTO` and restores through SQLite's backup
  API after staging, validating and migrating the file (`features/data.rs`); the
  current data is kept as `time-before-restore.db`.
- Import (Settings → Data) reads CSV files picked in Rust
  (`features/import.rs`) and converts them in `src/features/import/`: Todoist
  exports (TYPE/CONTENT/INDENT, priority 4 = p1) or any CSV with a Title
  column. Dates go through the Quick Add parser; anything it can't read is
  kept in the notes. Each file becomes a new project, removed again if a row
  fails, and Undo deletes the imported projects.
- Quick capture (`features/capture.rs`): Ctrl/⌘+Alt+N is a global shortcut
  (off with the `capture_hotkey` setting), and a second launch with
  `--quick-add` is forwarded by the single-instance plugin; both emit
  `quick-add`, which opens Quick Add. Wayland blocks global shortcuts, so
  there the user binds the command in their compositor.
- Reminders run on a backend thread (`features/reminders.rs`, every 20 s). A
  timed task fires once per date and time through `task.reminded_for`; only
  Linux reports the click, which emits `open-task`.
- `run()` sets `JSC_useJIT=0` on Linux: JavaScriptCore's JIT costs about 70 MB
  of web process memory in use and a planner doesn't need its speed.

### Frontend (`src/`)

- React 19 with React Compiler, TanStack Router (hash history) and TanStack
  Query, shadcn/ui (`src/components/ui`) on Tailwind v4, dnd-kit.
- `src/bindings.ts` is generated by tauri-specta on every debug run and by
  `cargo test`. Do not edit it; change the Rust types instead.
- `src/features/<domain>/api.ts` holds the queries and mutations for a domain;
  components live beside it.
- A project page always opens on Tasks, with Notes and Focus beside it. List,
  Board, saved views, Graph and Timeline are layouts of Tasks, and the last
  layout is remembered per project. `projects/ProjectContext.tsx` is the side
  panel (after the next task, this week, notes), fed by pure helpers in
  `projects/context.ts` (Next: work due by today by priority, then the earliest
  dated, then the highest-priority undated task; After that: upcoming dates only,
  one row per task). The sidebar is hidden by default (Mod+B); the project
  name is the switcher.
- Destructive and scheduling mutations offer Undo through `offerUndo`
  (`src/lib/undo.ts`, also Mod+Z outside text fields). Task changes restore a
  backend snapshot (`features/undo.rs`, `capture_tasks`/`restore_tasks`) kept in
  memory, so a task returns with its steps, blocks, links and history.
- Keyboard shortcuts go through `useShortcuts` (`src/lib/shortcuts.ts`);
  per-device UI preferences through `src/lib/preferences.ts`. New settings are a
  section in `features/settings/SettingsDialog.tsx` built from `SettingRow`.
- Any task or project on screen links to its own view: `TaskLink`/`TaskJump` in
  `features/tasks/TaskLink.tsx`, `ProjectLink`/`ProjectJump` in
  `features/projects/ProjectLink.tsx`. Use the Jump icon where the name is
  already a picker or toggle. `useOnNavigate` closes the task window and any
  ritual when a link changes the route; a ritual keeps its progress.
- Imports use `@/` instead of parent-relative `../` (enforced by ESLint).
- Routes: `/?view=day|week&week=` (`week` is a Monday date key), `/projects`,
  `/projects/someday`, `/projects/$projectId`, `/projects/groups/$groupId`,
  `/review/$week` (the first, guided review of a week). There is no Reports
  page: Week is the record. A past week swaps the task rail for its reflection,
  and a reviewed week is edited in `ReviewDialog`, never by reopening the guided
  review. All old `/reports/*`, `/time`, `/habits`, `/review`, `/inbox`,
  `/today`, `/upcoming`, `/someday`, `/planner` routes redirect.
- The Week grid fits 07:00–23:00 to the window. With sleep hours set (the
  `sleep` preference), Week fits all 24 hours and Day keeps them scrollable,
  with sleep shrunk to a strip. Positions come from a `TimeScale`
  (`planner/time-scale.ts`, a context in `planner/scale.ts`), so read it with
  `useTimeScale` and never multiply minutes by a constant. Each day column holds
  planned blocks and events on the left and tracked time entries in a lane on
  the right.
- `syncIdle` (`src/lib/idle.ts`) sets `html[data-idle]` while the window is
  hidden or unfocused, which pauses every CSS animation. Keep new looping
  animations in CSS so they inherit this.
- Habit auto-sync runs from the app shell (start, window focus at most every 5
  min) and when the Habits window opens.

## No root-level tooling

- No `pnpm-workspace.yaml` or root `package.json`
- No GitHub Actions workflows
- No shared ESLint, TypeScript, or prettier configs
- Each app is self-contained
