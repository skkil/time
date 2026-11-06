# AGENTS.md

skkil/time is a personal planner: tasks, nested projects, time-blocking, time
tracking, habits, and a weekly/quarterly review. Every app is local-first:
desktop, web and mobile run the same Rust domain (`time-core`) over their own
SQLite replica (natively, as WASM on OPFS, and through uniffi) and sync with
`apps/server` (Postgres, one account per user) through the separate
`../store` project once signed in (`docs/decisions/0001-sync-with-store.md`).
A signed-out desktop stays fully local; web and mobile need an account.

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
- **Group** — a named set of top-level projects in `apps/core/src/groups/` (table
  `project_group`, migrations 009 and 012); deleting one only clears it from its
  projects. The drawer lists top-level projects under their group; its heading
  opens the group overview (`/projects/groups/$groupId`, a timeline of every
  project's due dates, deadlines, milestones and target date, then one card per
  project). Each project also has a Timeline layout of its dated tasks
  (`projects/Timeline.tsx`).
- **Canvas** — one free-form document per project (`project_canvas`, migration
  013, `core/src/canvas/`), stored as HTML from the Tiptap editor in
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
  migration 010, `core/src/dependencies/`): `blocked_by` lists every link and
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
- **Ritual / RitualRun** — configurable routines in `core/src/rituals/`:
  morning, evening, wind_down, session (after a timer stops) and weekly. Each
  has one trigger (`first_open`, `at_time`, `end_of_day`, `after_timer_stop`,
  `manual`), weekdays (Monday = bit 0) and ordered steps from a closed library.
  `due_ritual(event)` decides what opens; a run fires once a day unless snoozed
  (15 min, once). The frontend shows rituals in a full-window zen overlay
  (`features/rituals`) over the same time-of-day sky as the app
  (`features/zen/ZenBackdrop.tsx`, deepened); there are no image assets.
- **Item type / Status / Milestone / Saved view** — per-project structure in
  `core/src/workflow/`. A type is a task or an **event** (happens at a time;
  never checked off; repeats expand into occurrences via `list_events`; may
  count as tracked time). Statuses are named freely, each in one fixed category
  (backlog, todo, active, done, dropped); a closed category and `completed_at`
  stay in step both ways, and backlog items never count as overdue. Presets
  (`workflow::presets`) set all four at once; Simple sets none, so a plain
  project looks as before. Moving a task between projects maps its type by name
  and its status by category.
- **Record** — a third type kind (migration 011, `core/src/records/`): a
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

All code lives under `apps/`; the repo root holds only docs, `assets/` and
`skkil.yml`. TypeScript apps share a pnpm workspace rooted at `apps/`, and the
server is its own Gradle project:

- `apps/core/`: `time-core`, the platform-free Rust domain (types, migrations,
  rules, queries, the mutation registry) for desktop, WASM and mobile
- `apps/core-wasm/`: `time-core-wasm`, the sync Engine for the browser
  (wasm-bindgen, SQLite on OPFS); `pnpm build` there writes the
  `@skkil-time/core-wasm` package to `pkg/` (needs `wasm-bindgen-cli` at the
  crate's pin; shrinks it with binaryen's `wasm-opt -Oz` when installed)
- `apps/desktop/`: Tauri 2 desktop app (Tauri wrappers over time-core + a thin
  React shell)
- `apps/server/`: Kotlin Spring Boot API (see its README)
- `apps/web/`: Vite + React web app, offline-first on core-wasm
- `apps/mobile/`: Expo React Native app over core-native
- `apps/core-native/`: `time-core-native`, time-core behind a uniffi interface,
  and `@skkil-time/core-native`, the React Native Turbo Module that
  uniffi-bindgen-react-native generates from it
- `apps/shared/*`: TypeScript packages; see `apps/shared/README.md`
  - `contract`: `bindings.ts` generated from Rust, the type contract for every app
  - `app`: the whole desktop/web UI, behind `Backend` and `Platform` ports
  - `domain`: platform-free rules (dates, day plan, due dates, timer, Quick Add)
  - `tokens`: colours and the sky; `pnpm generate` writes `tokens.css`
  - `api`: the server's `openapi.json`, generated types, typed fetch client
  - `remote`: the `Backend` over HTTP (`satisfies Backend`)
  - `local`: the `Backend` over a local time-core engine
  - `sync`: sync tokens, the account's scope and push headers for store's
    driver (web and mobile)
  - `auth`: provider-neutral OIDC sign-in
  - `tooling`: the ESLint, Prettier and TypeScript configs every package uses

Run `pnpm install` once in `apps/`; `pnpm lint|compile|test|format:check` there
runs every package. `apps/package.json`, `pnpm-workspace.yaml` and the lockfile
are the only files at that level. Each package has its own `eslint.config.js`
(`config({ ignores })` from `@skkil-time/tooling/eslint`), uses
`@skkil-time/tooling/prettier`, extends `tooling/tsconfig.base.json`, and lists
the tools its scripts run.

**Change once, reach every app.** UI goes in `apps/shared/app` (desktop and
web), rules in `apps/shared/domain` (all three), colours in
`apps/shared/tokens/src/colors.ts` (all three). Never copy logic into a shell
app. A new backend command needs the time-core function plus its entry in
`time_core::mutations` (a write) or its read list, the Tauri wrapper, a Kotlin
endpoint and a line in `apps/shared/remote`; `tsc` in `remote` fails until
they all agree.

`skkil.yml` wires the repo into the org CLI (`skkil`): `skkil dev` (Postgres,
mock sign-in, server, web, desktop), `skkil doctor`, `skkil ci` (format, lint,
test, build for every app), and `skkil assets generate`, which renders every app
icon from `assets/icon.svg`. `icon.icns` is not covered by skkil; regenerate it
with `pnpm tauri icon` from a 1024px render of the same master. Mobile's Android
adaptive layers come from `apps/mobile/scripts/android-icons.sh`.

Production setup is in `docs/deployment.md`; the open work list is
`BACKLOG.md`.

## Desktop app (`apps/desktop/`)

```bash
cd apps/desktop
pnpm tauri dev     # run the app with hot reload
pnpm tauri build   # release bundle under src-tauri/target/release/bundle
pnpm compile       # tsc -b
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm test          # Vitest

cd src-tauri      # and ../../core for time-core
cargo test
cargo clippy --all-targets -- -D warnings
```

### Todoist parity

- Quick add follows Todoist's syntax: dates and times in plain words, `every …`
  repeats, `{deadline}`, `p1`–`p4`, `#Project`, `/Section`, `+type`, `for 1h`.
  It lives in `apps/shared/domain/src/quick-add/` (the UI in
  `apps/shared/app/src/features/tasks/quick-add/`); each grammar is a rule
  table or pattern with tests beside it, and `parse.ts` runs them in order. Clicking a highlighted phrase keeps it as plain text.
- Repeats are read, advanced and given their first date in
  `apps/core/src/recurrence/`: rules in `rule.rs`, matchable days in
  `pattern.rs`, `every!` and end dates in `mod.rs`. The frontend only claims the
  phrase. `apps/shared/domain/src/quick-add/repeat-phrases.json` is read by the
  TypeScript, Rust and Kotlin (`apps/server/.../recurrence`) test suites, so a
  phrase a backend can't store fails the build.

### Domain crate (`apps/core/`, `time-core`)

- Platform-free Rust crate (lib `time_core`, no workspace; desktop depends on
  it by path). No Tauri, tokio or HTTP: it builds for
  `wasm32-unknown-unknown` with `--no-default-features` (rusqlite then uses
  `sqlite-wasm-rs`); the default `native` feature bundles SQLite, and the
  `specta` feature derives the TypeScript types (desktop turns it on).
- One folder per feature (`src/<feature>/`): `model.rs` (types),
  `queries.rs` (reads), `rules.rs` (validation), `service.rs` (writes) and
  `tests.rs`, split further where a feature is large (`workflow`, `review`).
  Shared pieces: `types` (`Id`, `Date`, `Timestamp`), `error`, `db`
  (connection, migrations), `env`, `recurrence`, `settings`.
- Ids are UUIDv7 strings (`types::Id`, TypeScript `string`). Migration 017
  rewrote every integer id and reference in one transaction, minting UUIDs in
  the old id order. Never sort by id for creation order: use `created_at` or
  `position`. Outcomes and priorities order by `position`, then `id`, as on
  the server (migration 020).
- Writes take `&dyn MutationEnv` (`env/`): `now()`, `today()` and
  `next_id()`. Hosts pass `LocalEnv`; tests pass `FixedClock` and
  `SequentialIds`. Writes never open their own transaction; the caller does.
  Seeded defaults get a name-based id from `env::seed_id(scope, kind)`.
- `mutations` is the registry of every synced write by its contract name
  (camelCase, args keyed like the TypeScript command): `apply`,
  `apply_in_transaction`, `query` for reads, and the `MUTATIONS`, `READS` and
  `DEVICE_ONLY` lists. Arguments take `0`/`1` for booleans, as on the server
  (`mutations/booleans.rs`). Its tests parse `bindings.ts`, so a new command
  must be classified, walk every mutation through `apply` and replay
  `mutation-vectors.json`.
- `sync` is the one entry point every host uses: `sync::Engine` owns the
  connection, registers `data::SYNCED_TABLES` with store-core and handles
  sign-in, upload (`importLocal`), issues and `forget`; `data` dumps and
  imports the synced rows.
- `src/db/migrations/*.sql` (plus Rust code migrations in `db/migrate.rs`)
  are embedded and applied in order, versioned with `PRAGMA user_version`.
  Never edit a shipped migration; add a new one.

### Backend (`apps/desktop/src-tauri/`)

- One crate (`skkil-time`, lib `skkil_time_lib`) holding only Tauri concerns.
  `src/commands/<feature>.rs` are thin `#[tauri::command]` wrappers: writes go
  through `time_core::mutations` (`commands::mutate`), reads call time-core.
- The database is `<app data dir>/com.skkil.time/time.db`, opened by
  `src/db.rs`, which keeps a one-time `time-before-uuid.db` copy before
  migration 017 runs. Use a scratch `XDG_DATA_HOME` when testing so the real
  database is never touched.
- Settings → Data exports with `VACUUM INTO` and restores through SQLite's backup
  API after staging, validating and migrating the file (`src/backup.rs`); the
  current data is kept as `time-before-restore.db`.
- Import (Settings → Data) reads CSV files picked in Rust
  (`commands/import.rs`) and converts them in
  `apps/shared/app/src/features/import/`: Todoist exports (TYPE/CONTENT/INDENT,
  priority 4 = p1) or any CSV with a Title column. Dates go through the Quick
  Add parser; anything it can't read is kept in the notes. Each file becomes a
  new project (`importProjects`, one transaction), and Undo deletes the
  imported projects.
- `skkil-time --mcp` (`src/mcp.rs`, checked in `main.rs` before Tauri starts)
  is a stdio MCP server for Claude and other agents. It opens the same
  database (or `SKKIL_TIME_DB`) and writes through the mutation registry: add,
  edit and archive projects and sections, today, list/add/update/move/complete
  tasks, and focus start/stop/break/history.
  Both processes share the file through WAL and a 5 s busy timeout; the app
  polls `external_changes` (`PRAGMA data_version`) every 10 s and on focus and
  refetches everything when another process wrote. MCP changes have no Undo.
- Quick capture (`src/capture.rs`): Ctrl/⌘+Alt+N is a global shortcut
  (off with the `capture_hotkey` setting), and a second launch with
  `--quick-add` is forwarded by the single-instance plugin; both emit
  `quick-add`, which opens Quick Add. Wayland blocks global shortcuts, so
  there the user binds the command in their compositor.
- Reminders run on a backend thread (`src/reminders.rs`, every 20 s). A
  timed task fires once per date and time through `task.reminded_for`; only
  Linux reports the click, which emits `open-task`.
- ActivityWatch is read in `src/activitywatch.rs`; `sync_habits` measures
  website and app habits with `habits::measure_activity` and records them
  with the `recordHabitMeasurements` mutation.
- Sync (`src/sync/`): every write goes through `time_core::sync::Engine`
  (`db::Db::mutate`), which captures it once the device is bound to an
  account. Sign-in is OIDC with PKCE in the system browser and a loopback
  redirect (`sync/auth/`), with tokens in the OS keychain (`keyring`) and
  refreshed. `SyncService` runs a worker thread that pushes then pulls with
  `skkil-store-http` on start, after writes (1.5 s debounce), on pokes, on
  window focus and every 60 s, backing off on failures (`sync/schedule.rs`,
  pure and tested); the account's scope comes from `scopeId` in
  `GET /api/v1/me` and sync tokens from `POST /api/v1/sync/token`. The first
  sign-in uploads the device's rows as one `importLocal` mutation (rules in
  the decision record's "First sign-in"). It emits `sync-status` and `remote-change`. Server URL, issuer, client id and
  audience are device settings defaulting to `SKKIL_SERVER_URL`,
  `SKKIL_AUTH_AUTHORITY`, `SKKIL_AUTH_CLIENT_ID` and `SKKIL_AUTH_AUDIENCE` at
  build time. Its commands are a second specta builder exported to
  `apps/desktop/src/bindings.ts`, outside the shared contract.
- `run()` sets `JSC_useJIT=0` on Linux: JavaScriptCore's JIT costs about 70 MB
  of web process memory in use and a planner doesn't need its speed.

### Frontend (`apps/shared/app/src/`, mounted by `apps/desktop/src/main.tsx`)

- React 19 with React Compiler, TanStack Router (hash history) and TanStack
  Query, shadcn/ui (`src/components/ui`) on Tailwind v4, dnd-kit.
- `apps/shared/contract/src/bindings.ts` is generated by tauri-specta on every
  debug run and by `cargo test`. Do not edit it; change the Rust types instead.
  UI code imports types and `commands` from `@/backend`, never from Tauri.
- Anything that differs between desktop and web goes through `platform()`
  (`src/platform/index.ts`): opening URLs, window focus, zoom, Tauri events, the
  signed-in account and `features` flags (capture hotkey, reminders,
  ActivityWatch, database-file backups). Settings sections declare
  `available(platform)`. A local-first shell adds `sync` (status, Sync now,
  issues, sign in/out, account choice, server config), shown as
  Settings → Sync (`features/sync/`, view logic in `view.ts`); desktop fills
  it in `apps/desktop/src/sync.ts`, web in `apps/web/src/platform/web-sync.ts`,
  and both reuse `onRemoteChange` and `onConnectionChange`. Its copy says
  "this device", never a platform noun. Undo keeps the `TaskSnapshot` payload in memory.
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
  backend snapshot (`core/src/undo/`, `capture_tasks`/`restore_tasks`) kept in
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

## Server (`apps/server/`)

- Kotlin 2.3, Spring Boot 4.1, Java 25, Postgres, Flyway, Spring `JdbcClient`
  with explicit SQL. `./gradlew spotlessApply test` (Testcontainers);
  `docker compose up -d` for local Postgres and a mock OIDC issuer.
- `features/<domain>/` mirrors `apps/core/src/<domain>/`: the same
  rules, validation messages and JSON shapes. Every query filters by
  `user_id`, and every referenced id is checked against the caller.
- Package by feature, layered inside: `features/<domain>/{api,service,
  repository,domain}` (only the layers a feature needs), one top-level class
  per file named after it. Shared code lives in `config/`, `security/` and
  `common/{error,web,persistence,text,clock,id}`; see the server README's
  "Code layout".
- Synced ids are UUIDs (UUIDv7 from `IdGenerator`; `app_user.id` stays bigint
  and `app_user.scope_id` is the store scope). New rows take
  `caller.nextId()`, and create methods accept an explicit `id`; an id that
  already exists anywhere is a `conflict`.
- Controllers take a `Caller` (user id + time zone from `X-Time-Zone`, plus the
  `MutationClock` and `IdGenerator` of the operation); use
  `caller.now()`/`caller.today()` wherever desktop uses local time, never
  `Instant.now()` (a test enforces it).
- Every `mutations` and `syncMutations` entry of
  `apps/shared/contract/src/commands.json` is registered in
  `features/mutations`
  (`MutationDispatcher.dispatch(caller, name, args, clock, idSource)`) and
  nothing else is; `MutationCoverageTest` checks names and parameters.
  Arguments take `0`/`1` for booleans, as in time-core. `natural-keys.json` and
  `mutation-vectors.json` beside it are read by the Rust and Kotlin tests
  alike, so ids and rows can't drift; extend the vectors when a mutation
  changes.
- The server is a store product (`features/sync`, store pinned by the root
  `STORE_VERSION`, adapter-jvm through a Gradle composite build from
  `STORE_DIR`, default `../store`). Store's SQL is copied as `V9`, `V10`,
  `V14` and `V16` (a test compares them with the checkout) and every user
  table keyed by a uuid is `store_register`ed, so a write outside the write
  path fails. `BaselineJob` (`features/sync/job/`) logs each account's
  unlogged rows once (`store_capture_existing` over `BASELINE_TABLES`,
  parents first, one advisory lock per account) and records it in
  `sync_baseline`; new accounts are recorded at creation, and a restore bumps
  the scope's epoch and baselines again. A migration that rewrites synced
  rows under `store.bypass` must clear those accounts' `sync_baseline` rows.
  Push (`/skkil.store.v1.PushService/Push`, API bearer) runs mutations
  through the dispatcher at the HLC with derived ids; a `DomainException`
  rejects. REST writes are server writes through `ServerWriteAspect`
  (one transaction per endpoint, no version when nothing synced changed);
  jobs and account setup use `ServerWrites.run(scope)`. Endpoints that open
  the write path themselves carry `@OwnWritePath`. Sync tokens come from
  `POST /api/v1/sync/token`; seeded rows take `UuidV5(scopeId,
  "<table>/<key>")` (rituals: `ritual/<kind>`) on every side. Undo is
  `captureTasks` (a read returning the snapshot) and `restoreTasks(snapshot)`
  (a mutation); nothing is stored on the server.
- Auth is an OAuth2 resource server only (`AUTH_ISSUER_URI`, `AUTH_AUDIENCE`);
  users are `user_identity (issuer, subject)` → `app_user`. Errors are RFC 9457
  problem details with a `kind` matching the desktop `Error`.
- After an API change: `./gradlew openApi`, then `pnpm generate` in
  `apps/shared/api`, then `pnpm exec tsc -b` in `apps/shared/remote`.
  `OpenApiDocumentTest` fails while the committed document is stale.
- Instant updates: `ChangeTrackingFilter` (`features/changes/web/`) has
  `ChangeService` bump the user's `data_version` after every successful write
  and publish a `ChangeEvent` (topic = first path segment) on Postgres
  `LISTEN/NOTIFY` (`features/realtime/service/RealtimeBus.kt`); each instance
  forwards it to that user's websockets at `/api/v1/realtime`
  (`features/realtime/websocket/`), opened with a one-time ticket from
  `POST /api/v1/realtime/tickets`. Events carry no data, only "refetch".
  A Push with an applied mutation does the same (topic `sync`), so REST
  clients refresh on device writes.
- Reminders on web and mobile are push (`features/notifications`):
  `job/ReminderJob.kt` runs every 20 s, one sender across instances via
  `pg_try_advisory_xact_lock`, and fires each timed task once per date and
  time through `reminded_for` (as desktop does) to every `push_device` through
  the senders in `push/` (Expo or Web Push/VAPID). Web uses `public/sw.js` and
  `Platform.notifications`; mobile `src/core/notifications/`.
- Account-wide preferences are one JSON object (`features/preferences`,
  `PATCH` merges, `null` removes a key).

## Web and mobile

- Web (`apps/web/`) is `mount()` from `apps/shared/app` with
  `createLocalBackend` over time-core in WASM (`apps/core-wasm`), a browser
  `Platform` and OIDC sign-in (`apps/shared/auth/web`). Config is `VITE_*` at
  build time or `config.js` at container start; the store URL comes with each
  sync token. Details in `apps/web/README.md`.
- Each tab starts a dedicated worker (`src/engine/worker/`). The worker that
  holds the Web Lock `skkil-time-engine` opens the database on OPFS (SAH-pool
  VFS, no COOP/COEP needed) and runs `@skkil/store-client`'s driver
  (`SyncRunner`, `noopLock`); the others relay calls over the
  BroadcastChannel of the same name, and a closed owner hands over to the
  next worker (reads retried, writes fail with "try again"). The page talks
  to its worker through `src/engine/client.ts` (`EngineClient.call(method,
  …args)`, errors as `{ kind, message }`).
- `@skkil/store-client` is linked by path from the store checkout
  (`link:../../../store/modules/client-ts`, built there); the Docker image
  builds it and the wasm from `--build-context store=…`.
- `Platform.sync` on web (`platform/web-sync.ts`) binds the engine to the
  account's scope (`/api/v1/me` `scopeId`, through `@skkil-time/sync`), asks
  before touching another account's data, and maps the worker's
  `SyncState` to Settings → Sync. Signing out syncs, confirms before
  dropping unsynced changes and calls `forget`. Whoever signed in last can
  open the app offline (`WebAuth.lastSession`).
- Pulled changes and other tabs' writes reach the app as `onRemoteChange`
  topic `sync`; the realtime socket stays only for account preferences.
  `mount` sets TanStack Query's `networkMode: 'always'` on platforms with
  `sync`, so nothing pauses offline.
- `public/sw.js` keeps the app shell for offline starts (the build's
  `shell-files.json`, `index.html`, `config.js`). Browsers without OPFS fall
  back to the remote backend (`app/start-remote.tsx`).
- `Platform.onRemoteChange` and `Platform.preferences` are optional ports.
  `SHARED_KEYS` in `lib/preferences.ts` decides which preferences follow the
  account; the rest stay on the device.
- Web's `src/` is `app/` (bootstrap, local and remote starts, config),
  `auth/`, `engine/` (worker RPC and the worker), `platform/` (the browser
  `Platform`: files, device commands, sync, sign-out, connection, live
  updates, account preferences) and `notifications/`; `main.tsx` only
  starts the app.
- Mobile (`apps/mobile/`) is Expo Router. It shares `domain`, `tokens`,
  `contract`, `api`, `local` and `sync`, not DOM components. `app/` holds routes
  only; screens, components and hooks live in `src/features/<name>/`,
  services in `src/core/`, shared UI in `src/ui/` (see its README).
  `pnpm compile`, `pnpm test` and `npx expo export` check it.
  Screens pass `aside={<TaskAside />}` to `Screen` to show the task beside
  the list on screens 768pt or wider (`ui/responsive.ts`).
- Mobile works offline: `commands` (`src/core/local/backend.ts`) is
  `createLocalBackend` over `@skkil-time/core-native`, opened on
  `<documents>/time.db` (`src/core/local/replica.ts`). The engine runs on its
  own Rust thread: commands and account steps are async, store's
  `CoreHandle` calls are synchronous (the driver's contract). The `api`
  client is only for what the server alone does: sync tokens, `/me`, account
  deletion, preferences, push devices.
- Mobile sync (`src/core/sync/`) runs `@skkil/store-client` (linked from
  `../store` at `STORE_VERSION`) with `expo/fetch` for the Pokes stream.
  `controller.ts` binds the replica to the account (scope, sync tokens and
  push headers from `@skkil-time/sync`, signing out when the server refuses
  the sign-in), asks Keep this data / Use the account's data when it holds
  another account's rows, and pushes soon after every local write. `use-sync.ts` starts it while signed
  in, restarts it on foreground and reconnect and pauses it in the
  background; pulls refresh the queries. Signing out in Settings forgets the
  replica; an expired sign-in keeps it. Settings → Sync shows pending
  changes, last sync, Sync now and refused changes.
- `apps/core-native`: `pnpm build:android` (cargo-ndk, NDK 30, arm64-v8a and
  x86_64) builds the static libraries into `android/src/main/jniLibs` and
  regenerates the committed bindings (`src/native`, `cpp`, `android`, `ios`,
  `CoreNative.podspec`); `pnpm build:ios` needs macOS, `pnpm check:ios`
  type-checks the iOS targets on Linux. Build the libraries before
  `expo prebuild` / `expo run:*`.
