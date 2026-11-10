# AGENTS.md

skkil/time is a personal planner: tasks, nested projects, time-blocking, time
tracking, habits, rituals and a weekly/quarterly review. It is local-first:
desktop, web and mobile run the same Rust domain (`time-core`) over their own
SQLite replica (natively, as WASM on OPFS, and through uniffi) and sync with
`apps/server` (Kotlin, Postgres, one account per user) through the separate
store project (`../store`, pinned by `STORE_VERSION`) once signed in. A
signed-out desktop stays fully local; web and mobile need an account.

## Repository structure

```
/                    package.json, pnpm-workspace.yaml, pnpm-lock.yaml, skkil.yml, STORE_VERSION
├── assets/          icon.svg, the master for every app icon
├── infra/           compose.yaml (Postgres, mock OIDC, store service), mock-login.html
└── apps/
    ├── shared/      core (Rust) + ui, design, rules, client, config (TypeScript)
    ├── desktop/     src/ (React shell) + src-tauri/ (Rust)
    ├── web/         src/ + engine/ (time-core as WASM)
    ├── mobile/      app/, src/ + native/ (time-core through uniffi)
    └── server/      Kotlin Spring Boot API
```

| Path | Name | What it is |
|---|---|---|
| `apps/shared/core` | crate `time-core` (lib `time_core`) | Platform-free domain: types, migrations, rules, queries, the mutation registry, the sync engine |
| `apps/desktop/src-tauri` | crate `skkil-time` (lib `skkil_time_lib`) | Tauri 2 host: thin commands, backups, reminders, capture, ActivityWatch, MCP, sync |
| `apps/desktop` | `@skkil-time/desktop` | Mounts `@skkil-time/ui` with the Tauri backend and platform |
| `apps/web` | `@skkil-time/web` | Vite app: the same UI over the WASM engine in a worker |
| `apps/web/engine` | crate `time-core-wasm`, package `@skkil-time/core-wasm` | wasm-bindgen wrapper over the sync engine; `pnpm build` writes `pkg/` |
| `apps/mobile` | `@skkil-time/mobile` | Expo Router app (React Native) |
| `apps/mobile/native` | crate `time-core-native`, package `@skkil-time/core-native` | uniffi object over the engine, turned into a Turbo Module by uniffi-bindgen-react-native |
| `apps/server` | Gradle project | Kotlin 2.3, Spring Boot 4.1, Java 25, Postgres, Flyway |
| `apps/shared/ui` | `@skkil-time/ui` | The whole desktop/web React UI, behind the `Backend` and `Platform` ports |
| `apps/shared/design` | `@skkil-time/design` | Colours and the sky; `pnpm generate` writes `tokens.css` |
| `apps/shared/rules` | `@skkil-time/rules` | Platform-free rules: dates, day plan, due dates, timer, Quick Add, sync messages |
| `apps/shared/client` | `@skkil-time/client` | Talking to time-core and the server, by subpath (below) |
| `apps/shared/config` | `@skkil-time/config` | Shared ESLint, Prettier and TypeScript configs |

`@skkil-time/client` subpaths: `/types` (`bindings.ts` generated from Rust,
`commands.json`, `natural-keys.json`, `mutation-vectors.json`), `/server` (the
server's `openapi.json`, generated `schema.ts`, typed fetch client and the
`Backend` over HTTP; `/server/realtime` for the socket), `/local` (the
`Backend` over a local engine), `/sync` (sync tokens, the account's scope and
push headers for store's driver) and `/sign-in` (provider-neutral OIDC;
`/sign-in/web` with `oidc-client-ts`). `pnpm generate` there rewrites
`src/server/schema.ts` and `src/local/catalog.ts`; `pnpm check:generated`
fails when either is stale.

Layout rules:

- `apps/<app>/` holds everything only that app uses (its UI, Rust bridge,
  Dockerfile, scripts). `apps/shared/` holds what several apps use. `infra/`
  holds the environment around the apps.
- Each Rust crate keeps its own `Cargo.lock`; there is no Cargo workspace,
  because feature unification would turn time-core's default `native`
  feature (bundled SQLite) back on for the wasm build.
- Shared packages are named by role; "core" means only the Rust domain.
- The pnpm workspace is rooted at the repo root. `pnpm install` once there;
  `pnpm lint|compile|test|format|format:check` there runs every package. Each
  package has its own `eslint.config.js` (`config({ ignores })` from
  `@skkil-time/config/eslint`), uses `@skkil-time/config/prettier`, extends
  `@skkil-time/config/tsconfig.base.json` and lists the tools its scripts run.
- TypeScript packages are source-only (`workspace:*`, no build step). Inside a
  package import siblings with `#name` subpath imports, not `../`. The `ui`
  package uses `@/`, which each consuming app maps to `apps/shared/ui/src`
  (enforced by ESLint).

**Change once, reach every app.** UI goes in `apps/shared/ui` (desktop and
web), rules in `apps/shared/rules` (all three), colours in
`apps/shared/design/src/colors.ts` (all three). Never copy logic into a shell
app. A new backend command needs the time-core function plus its entry in
`time_core::mutations` (a write) or its read list, its classification in
`commands.json`, the Tauri wrapper, a Kotlin endpoint or mutation set and a
line in `apps/shared/client/src/server`; `tsc` in `client` fails until they
agree.

## Commands

`skkil.yml` wires the repo into the org CLI (`skkil`):

- `skkil doctor` checks the toolchain: Node 22+, pnpm, Rust, JDK 25, Docker,
  Go, `wasm-bindgen-cli` at the pin in `apps/web/engine/Cargo.toml`,
  cargo-ndk, Android NDK 30, and the store checkout at `STORE_VERSION` with
  its `modules/client-ts` built.
- `skkil dev` runs `docker compose up --build` in `infra/` (Postgres on 5433,
  mock OIDC on 8090, store service on 8091), the server (`./gradlew bootRun`
  once Postgres is healthy), web (`pnpm dev`) and desktop (`pnpm tauri dev`).
- `skkil ci` runs format, lint, test and build for every task: `time-core`,
  `web-engine`, `desktop-tauri` (also fails if `bindings.ts` changed),
  `shared-rules`, `shared-design`, `shared-ui`, `shared-client`, `server`,
  `store-conformance`, `web`, `mobile-native`, `mobile`, `mobile-android`,
  `desktop`.
- `skkil assets generate` renders every app icon from `assets/icon.svg`.
  `icon.icns` is not covered; regenerate it with `pnpm tauri icon` from a
  1024px render. Android adaptive layers come from
  `apps/mobile/scripts/android-icons.sh`.
- `skkil device init` / `skkil device up <name>` runs the mobile app on an
  Android device through `apps/mobile/scripts/run-android.sh`.

Per app:

```bash
cd apps/shared/core && cargo test && cargo clippy --all-targets --features specta -- -D warnings
cd apps/desktop && pnpm tauri dev | pnpm tauri build | pnpm compile | pnpm lint | pnpm test
cd apps/desktop/src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
cd apps/web/engine && pnpm build          # needs wasm-bindgen-cli; wasm-opt -Oz when installed
cd apps/web && pnpm dev | pnpm test | pnpm build
cd apps/mobile/native && pnpm build:android | pnpm build:ios | pnpm check:ios
cd apps/mobile && pnpm start | pnpm android | pnpm compile | pnpm test
cd apps/server && ./gradlew spotlessApply test | ./gradlew bootRun | ./gradlew openApi
```

## Domain model

- **Project**: nested (max depth 3), with colour, list/board view, archived
  flag and settings: `group_id` (top-level only; sub-projects follow it),
  `status` (active/paused/done/dropped; inactive ones leave Day and the
  drawer), weekly hours budget, target date, stop-if criteria, review cadence
  and `in_order`. Archiving or deleting cascades to the subtree. No areas:
  ongoing work is a project without a target date. `NULL` project is Inbox.
- **Group**: a named set of top-level projects (`core/src/groups/`, table
  `project_group`); deleting one only clears it from its projects. Its
  overview (`/projects/groups/$groupId`) is a timeline of every project's
  dates, then one card per project.
- **Canvas**: one Tiptap HTML document per project (`project_canvas`,
  `core/src/canvas/`), the project's Notes tab.
- **Section**: ordered group inside a project or the Inbox; deleting it
  deletes its tasks.
- **Task**: Todoist-shaped: title, `notes`, project, section, parent
  (sub-tasks nest to any depth, inherit project/section; complete, move and
  delete reach every level), priority 1–4 (1 = highest), due date and
  optional time, deadline, recurrence, `estimate_minutes`, sibling
  `position`, `rollover_count`, `someday`, `must_on` (at most 3 musts a day)
  and a `next_step` note. Dependencies (`task_dependency`,
  `core/src/dependencies/`): `blocked_by` lists every link, `waiting_on` the
  open ones; "blocked" is derived, never stored; loops, self-links and
  repeating or event blockers are refused. Completing a repeating task moves
  its date forward.
- **TimeBlock**: a planned span for a task on the schedule grid.
- **TimeEntry**: tracked time with optional project/task; a linked task
  decides the project. The running timer is one row in `running_timer`, so it
  survives restarts and syncs to every device; stopping makes an entry, and
  finishing a task stops a timer on it or anything under it. A break logs the
  stretch so far and sets `paused_at`; `banked_seconds` keeps the session
  total. `list_time_entries` returns entries overlapping the range (clip with
  `secondsWithin`); `list_task_entries` and `list_project_entries` return the
  whole history, including sub-tasks or sub-projects. `list_tasks` leaves out
  tasks closed over two weeks ago; `useTask` fetches those on demand.
- **Habit / HabitLog**: `build` (reach a goal), `quit` (none) or `limit` (at
  most a goal), in times or minutes, with repeat days, time of day, area and
  start date. Optional `tracking` (websites, apps, or a project's tracked
  time): `sync_habits` writes measured values as `auto` logs, and a status set
  by hand always wins. Daily status is derived in `habits::status`. Websites
  and apps come from ActivityWatch (`SKKIL_ACTIVITYWATCH_URL`, default
  `http://localhost:5600`). Progress is "x of last 14 days" with planned rest
  days, no streaks.
- **Ritual / RitualRun**: routines in `core/src/rituals/`: morning, evening,
  wind_down, session (after a timer stops) and weekly. One trigger
  (`first_open`, `at_time`, `end_of_day`, `after_timer_stop`, `manual`),
  weekdays (Monday = bit 0) and ordered steps from a closed library.
  `due_ritual(event)` decides what opens; a run fires once a day unless
  snoozed (15 min, once). Shown in a full-window overlay (`features/rituals`)
  over the time-of-day sky (`features/zen/ZenBackdrop.tsx`); no image assets.
  On the `review_day` setting (Monday = 0, default Sunday) the evening checkout
  goes on to close the week (`week_to_close`), running the review steps as a
  `weekly` run; the next morning offers an unclosed week once. The standalone
  `weekly` ritual is manual.
- **Item type / Status / Milestone / Saved view**: per-project structure in
  `core/src/workflow/`. A type is a task or an **event** (happens at a time,
  never checked off; repeats expand via `list_events`; may count as tracked
  time). Statuses are named freely, each in a fixed category (backlog, todo,
  active, done, dropped); a closed category and `completed_at` stay in step,
  and backlog items are never overdue. Presets (`workflow::presets`) set all
  four; Simple sets none. Moving a task maps its type by name and its status
  by category.
- **Record**: a third type kind (`core/src/records/`): a long-lived item with
  no checkbox whose status is its current **phase** (e.g. one job
  application). Its sub-tasks carry `phase_id`; `record_phase` holds a note
  per phase. Moving it maps phases by name. The task window pages phases
  (`features/records/PhasePager.tsx`); records stay off Day, Week and the
  review deck.
- **Day / Week / Quarter**: a day note and felt rating written by rituals;
  weekly outcomes (at most 3 open, linked through `task.outcome_id`; status
  open/achieved/carried/dropped; carrying copies the outcome and its open
  tasks into next week, at most twice); a guided weekly review (feel,
  outcomes, clear the deck, one change, plan, quarter wrap-up; progress in
  `week.step`, done at `week.reviewed_at`); quarter priorities over 13 weeks.
- **Calendar**: Google Calendar read on the server (`core/src/calendar/`,
  server `features/calendar/`). `calendar_source` (one calendar; devices
  only toggle `visible` with `setCalendarSourceVisible`) and
  `calendar_event` (server-written; a time-core trigger refuses any write a
  mutation makes to it) sync like other rows but stay out of `dump`,
  `importLocal` and `deleteAllData`. Accounts and their AES-GCM-sealed
  tokens (`calendar_account`) never leave the server. Week draws timed
  events in the plans column and all-day ones above the day; Day threads
  them; new blocks placed by click avoid firm events
  (`@skkil-time/rules/calendar`). Settings → Calendars talks to the server
  through `Platform.calendars`.

## time-core (`apps/shared/core/`)

- No Tauri, tokio or HTTP. Builds for `wasm32-unknown-unknown` with
  `--no-default-features` (rusqlite then uses `sqlite-wasm-rs`); the default
  `native` feature bundles SQLite; `specta` derives the TypeScript types.
- One folder per feature (`src/<feature>/`): `model.rs`, `queries.rs`,
  `rules.rs`, `service.rs`, `tests.rs`, split further where large
  (`workflow`, `review`). Shared: `types` (`Id`, `Date`, `Timestamp`),
  `error`, `db`, `env`, `recurrence`, `settings`, `device_settings`.
- Ids are UUIDv7 strings. Never sort by id for creation order: use
  `created_at` or `position`. Lists order by `position`, then `id`, as on the
  server.
- Writes take `&dyn MutationEnv` (`env/`: `now()`, `today()`, `next_id()`).
  Hosts pass `LocalEnv`; tests pass `FixedClock` and `SequentialIds`. Writes
  never open their own transaction; the caller does. Natural-key ids are
  built only through `env::NaturalKey`.
- `mutations` is the registry of every synced write by contract name
  (camelCase, args keyed like the TypeScript command): `apply`,
  `apply_in_transaction`, `query`, and the `MUTATIONS`, `READS` and
  `DEVICE_ONLY` lists in `catalog.rs`. Booleans may be `0`/`1`
  (`booleans.rs`). Its tests parse `bindings.ts` (every command must be
  classified), walk every mutation through `apply` and replay
  `mutation-vectors.json`.
- `sync::Engine` is the one entry point every host uses (below); `data`
  dumps and imports the synced rows (`data/tables.rs`: `SYNCED_TABLES`,
  `NATURAL_KEYS`).
- `src/db/migrations/*.sql` plus Rust code migrations in `db/migrate.rs` are
  embedded and versioned with `PRAGMA user_version`. Never edit a shipped
  migration; add a new one.
- Repeats live in `src/recurrence/` (`rule.rs`, `pattern.rs`, `mod.rs` for
  `every!` and end dates). `apps/shared/rules/src/quick-add/repeat-phrases.json`
  is read by the TypeScript, Rust and Kotlin
  (`features/recurrence`) tests, so a phrase a backend can't store fails the
  build.

## Sync

The protocol is store's (`docs/protocol.md` in the store repo). How time maps
onto it:

- **Engine.** `time_core::sync::Engine` owns the connection, registers
  `SYNCED_TABLES` with store-core and exposes `mutate`, `query`, push/pull,
  status, `issues`, `dismiss_issue`, `retry_issue`, `sign_in`/`keep_local`/
  `start_fresh` and `forget`. Desktop calls it natively, web through
  `time-core-wasm` in a worker, mobile through `time-core-native`.
  Device-only state lives in `device_setting` (capture hotkey, sync server
  config, a staged upload) and never syncs.
- **Mutations.** A mutation is a write command: `name` is its contract name,
  `args` its parameters keyed by contract names. time-core and the server
  keep one registry each with the same rules; the server's result is
  authoritative and replaces the device's optimistic result on the next
  pull. Reads and device-only commands (file pickers, hotkey, local file
  backups, ActivityWatch) are never mutations. A mutation's clock is its
  HLC, so "now" and "today" are when the user acted, in their time zone.
- **Ids.** Device ids come from `MutationContext::next_id()`, derived from
  the client and mutation so the server reproduces them; server-made ids are
  UUIDv7.
- **Natural keys.** A row identified by something other than its id never
  takes a random or derived id once the device is bound: its id is
  `UuidV5(scope_id, "<table>/<key parts joined by />")`, with lowercase
  uuids and `yyyy-MM-dd` dates, and it draws no id from `next_id()`. Names:
  `setting/<key>`, `project_canvas/<projectId>`, `week/<monday>`,
  `day/<date>`, `task_dependency/<taskId>/<blockedById>`,
  `record_phase/<taskId>/<statusId>`, `running_timer`,
  `habit_log/<habitId>/<date>`, `ritual/<kind>`, `user_preference`,
  `calendar_source/<accountId>/<calendarId>` and
  `calendar_event/<sourceId>/<eventId>` (server-made; with
  `singleEvents=true` an instance's id already holds its original start). The
  server builds them in `common/id/NaturalIds.kt`; both sides test against
  `natural-keys.json`. `quarter` keeps an ordinary id (its start can change),
  so a second offline create is a conflict.
- **Ordering.** Positions are dense integers; moves are intents ("index N
  among siblings") the server replays, and renumbered rows reach devices
  through the log.
- **Signed out.** A never-bound device writes straight to SQLite with no
  capture. Once bound, every write is captured, even while signed out.
- **First sign-in.** The device reads its scope from `scopeId` in
  `GET /api/v1/me`. `sign_in(scope)` returns `Synced`, `Uploading` or
  `OtherAccount` (nothing happens until the user picks `keep_local`, which
  re-ids every row, or `start_fresh`). Uploading dumps every synced row into
  `device_setting.sync_upload`, forgets, binds the scope, seeds the default
  rituals with scope ids, and sends one `importLocal` mutation; a crash
  before the staged copy is removed re-runs the upload. `importLocal` is a
  `syncMutations` entry implemented by `time_core::data::import` and the
  server's `LocalImportService` with the same rules: natural-key rows take
  the account's key id; an id another account owns is refused; a row whose
  natural key (the tables above plus a group's name, a quarter's start and
  imported `external_id`s) matches an account row merges into it; anything
  else keeps the device's id; every reference must name a row of the
  account. Uploaded values win for shared rows.
- **Refused changes.** A mutation the server rejects is undone on the device
  and kept as an issue with its name, arguments and reason. Settings → Sync
  offers Try again (`retry_issue` re-queues it as a new mutation) and
  Dismiss (drops the only copy; for `importLocal` the UI asks first).
- **Cross-language checks.** `commands.json` (every command's category),
  `natural-keys.json` and `mutation-vectors.json` (an ordered run of
  mutations with fixed clocks, ids and expected rows) in
  `apps/shared/client/src/types/` are read by both the Rust and Kotlin
  tests. Extend the vectors when a mutation changes.
- **Undo.** `captureTasks` is a read returning a `TaskSnapshot` the UI keeps
  in memory; `restoreTasks(snapshot)` is a mutation. Nothing is stored on the
  server.

## Desktop (`apps/desktop/`)

- `src-tauri/src/commands/<feature>.rs` are thin `#[tauri::command]`
  wrappers: writes go through `time_core::mutations` (`commands::mutate`),
  reads call time-core. tauri-specta writes
  `apps/shared/client/src/types/bindings.ts` on every debug run and on
  `cargo test`; never edit it. Sync commands are a second builder exported
  to `apps/desktop/src/bindings.ts`, outside the shared contract.
- The database is `<app data dir>/com.skkil.time/time.db` (`src/db.rs`,
  which keeps a one-time `time-before-uuid.db` before migration 017). Use a
  scratch `XDG_DATA_HOME` when testing.
- Settings → Data exports with `VACUUM INTO` and restores through SQLite's
  backup API after staging, validating and migrating (`src/backup.rs`),
  keeping `time-before-restore.db`. CSV import is picked in Rust
  (`commands/import.rs`) and converted in `ui/src/features/import/`: Todoist
  exports or any CSV with a Title column, one new project per file, Undo
  deletes them.
- `skkil-time --mcp` (`src/mcp.rs`) is a stdio MCP server on the same
  database (or `SKKIL_TIME_DB`), writing through the registry: projects,
  sections, today, tasks and focus. Both processes share the file through
  WAL and a 5 s busy timeout; the app polls `PRAGMA data_version` every 10 s
  and on focus. MCP changes have no Undo.
- Quick capture (`src/capture.rs`): Ctrl/⌘+Alt+N (setting
  `capture_hotkey`), or a second launch with `--quick-add`. Wayland blocks
  global shortcuts, so users bind the command in their compositor.
- Reminders (`src/reminders.rs`) check every 20 s and fire each timed task
  once per date and time through `task.reminded_for`.
- ActivityWatch (`src/activitywatch.rs`) feeds `habits::measure_activity`
  and the `recordHabitMeasurements` mutation.
- Sync (`src/sync/`): OIDC with PKCE in the system browser and a loopback
  redirect (`sync/auth/`), tokens in the OS keychain. `SyncService` pushes
  then pulls with `skkil-store-http` on start, after writes (1.5 s
  debounce), on pokes, on focus and every 60 s, backing off on failure
  (`sync/schedule.rs`). Server URL, issuer, client id and audience default
  to `SKKIL_SERVER_URL`, `SKKIL_AUTH_AUTHORITY`, `SKKIL_AUTH_CLIENT_ID` and
  `SKKIL_AUTH_AUDIENCE` at build time and can be changed in Settings → Sync.
- `run()` sets `JSC_useJIT=0` on Linux to save about 70 MB.

## Shared UI (`apps/shared/ui/src/`)

- React 19 with React Compiler, TanStack Router (hash history) and TanStack
  Query, shadcn/ui (`components/ui`) on Tailwind v4, dnd-kit.
- UI code imports types and `commands` from `@/backend`, never from Tauri.
  `src/features/<domain>/api.ts` holds a domain's queries and mutations;
  components live beside it.
- Anything that differs per host goes through `platform()`
  (`platform/index.ts`): URLs, window focus, zoom, events, the account,
  `features` flags (capture hotkey, reminders, ActivityWatch, file backups)
  and, on local-first hosts, `sync` (Settings → Sync, `features/sync/`, view
  logic in `view.ts`). Desktop fills it in `apps/desktop/src/sync.ts`, web in
  `apps/web/src/platform/web-sync.ts`. Settings sections declare
  `available(platform)`. Sync errors show plain copy from
  `@skkil-time/rules/sync-messages`; copy says "this device", never a
  platform noun.
- Undo: destructive and scheduling mutations call `offerUndo`
  (`lib/undo.ts`, also Mod+Z outside text fields); task changes restore a
  backend snapshot (`core/src/undo/`).
- Shortcuts go through `useShortcuts` (`lib/shortcuts.ts`), per-device
  preferences through `lib/preferences.ts` (`SHARED_KEYS` follow the
  account). New settings are a section in
  `features/settings/SettingsDialog.tsx` built from `SettingRow`.
- Any task or project on screen links to its view: `TaskLink`/`TaskJump`
  (`features/tasks/TaskLink.tsx`), `ProjectLink`/`ProjectJump`
  (`features/projects/ProjectLink.tsx`). `useOnNavigate` closes the task
  window and any ritual when a link changes the route.
- A project page opens on Tasks, with Notes and Focus beside it; List,
  Board, saved views, Graph and Timeline are layouts of Tasks, remembered per
  project. `projects/ProjectContext.tsx` is the side panel, fed by
  `projects/context.ts`. The sidebar is hidden by default (Mod+B).
- Quick Add follows Todoist's syntax (plain-word dates, `every …`,
  `{deadline}`, `p1`–`p4`, `#Project`, `/Section`, `+type`, `for 1h`). The
  parser is `apps/shared/rules/src/quick-add/` (one rule table per grammar,
  run in order by `parse.ts`); the UI is `features/tasks/quick-add/`.
- Routes: `/?view=day|week&week=` (a Monday date key), `/projects`,
  `/projects/someday`, `/projects/$projectId`, `/projects/groups/$groupId`,
  `/review/$week` (the first, guided review). There is no Reports page: Week
  is the record; a reviewed week is edited in `ReviewDialog`. Old routes
  redirect.
- The Week grid fits 07:00–23:00, or all 24 hours with the `sleep`
  preference. Positions come from a `TimeScale` (`planner/time-scale.ts`);
  read it with `useTimeScale`, never multiply minutes by a constant. Each day
  column holds plans and events on the left and tracked time on the right.
- `syncIdle` (`lib/idle.ts`) sets `html[data-idle]` while the window is
  hidden or unfocused, pausing CSS animations. Keep looping animations in
  CSS.

## Web (`apps/web/`)

- `mount()` from `@skkil-time/ui` with `createLocalBackend` over the WASM
  engine, a browser `Platform` and OIDC from `@skkil-time/client/sign-in/web`.
  Config is `VITE_*` at build time or `config.js` at container start; the
  store URL comes with each sync token.
- `src/` is `app/` (bootstrap, local and remote starts), `auth/`, `engine/`
  (page-to-worker RPC and the worker), `platform/` and `notifications/`.
- Each tab starts a dedicated worker. The one holding the Web Lock
  `skkil-time-engine` opens SQLite on OPFS (SAH-pool VFS, no COOP/COEP) and
  runs `@skkil/store-client`'s `SyncRunner`; others relay over the
  BroadcastChannel of the same name and take over in lock order (reads
  retried, writes fail with "try again").
- Pulls and other tabs' writes reach the UI as `onRemoteChange` topic
  `sync`; the realtime socket is only for account preferences. Signing out
  syncs, asks before dropping unsynced changes and calls `forget`.
- `public/sw.js` caches the app shell for offline starts. Browsers without
  OPFS fall back to the remote backend (`app/start-remote.tsx`).
- `@skkil/store-client` is linked by path
  (`link:../../../store/modules/client-ts`), as on mobile.

## Mobile (`apps/mobile/`)

- Expo Router: `app/` holds routes only; screens and hooks live in
  `src/features/<name>/`, services in `src/core/`, shared UI in `src/ui/`.
  Day, Week and Projects sit behind a floating pill (`features/shell/`) on
  the sky (`ui/Sky.tsx`, dark only), with tasks, Quick Add, focus and habits
  as glass windows (`ui/Window.tsx`). It shares `rules`, `design` and
  `client`, not DOM components. Screens pass `aside={<TaskAside />}` to
  `Screen` for a side task view at 768pt or wider.
- `src/core/local/backend.ts` is `createLocalBackend` over
  `@skkil-time/core-native` on `<documents>/time.db`. The engine runs on one
  Rust thread: commands are async, store's `CoreHandle` calls synchronous.
  The server API is used only for sync tokens, `/me`, account deletion,
  preferences and push devices.
- `src/core/sync/` runs `@skkil/store-client` with `expo/fetch` for Pokes;
  `controller.ts` binds the replica to the account, `use-sync.ts` runs it in
  the foreground. Signing out forgets the replica; an expired sign-in keeps
  it.
- `native/`: `pnpm build:android` (cargo-ndk, NDK 30, arm64-v8a and x86_64)
  builds the static libraries and regenerates the committed bindings
  (`src/native`, `cpp`, `android`, `ios`, `CoreNative.podspec`). Build them
  before `expo prebuild` or `expo run:*`.
- Home-screen widgets (Today, Quick add) never open SQLite.
  `src/core/widgets/` reads `todayGlance` after local writes, pulls and
  foregrounding (1 s debounce), turns it into a `WidgetSnapshot` (one entry
  per change until midnight, text, sky colours) and hands the JSON to the
  local module `modules/widgets` (`SkkilWidgets.publish`), which writes
  `glance.json` (Android `filesDir/widgets`, iOS App Group
  `group.com.skkil.time`) and reloads the widgets. Android providers and
  layouts live in that module; the iOS WidgetKit extension is
  `targets/widgets` (SwiftUI, linked by `@bacons/apple-targets` on prebuild).
  Native code only picks the entry for the current time and draws it; the
  Today widget's copy and timing stay in TypeScript. Taps open `skkiltime:///` (Day) and
  `skkiltime://add`.

## Server (`apps/server/`)

- `JdbcClient` with explicit SQL; Flyway migrations in
  `src/main/resources/db/migration` are immutable once shipped (Flyway
  checksums them). `features/<domain>/` follows time-core's rules,
  validation messages and JSON shapes. Every query filters by `user_id` and
  every referenced id is checked against the caller.
- Package by feature, layered inside (`api`, `service`, `repository`,
  `domain`, only as needed), one top-level class per file. Shared code is in
  `config/`, `security/` and `common/{error,web,persistence,text,clock,id}`.
- Controllers take a `Caller` (user, time zone from `X-Time-Zone`, the
  operation's `MutationClock` and `IdGenerator`). Use
  `caller.now()`/`caller.today()`, never `Instant.now()` (a test enforces
  it). New rows take `caller.nextId()`; an id that exists anywhere is a
  `conflict`.
- `features/mutations` registers exactly the `mutations` and
  `syncMutations` of `commands.json` (`MutationCoverageTest`);
  `MutationVectorsTest` and `NaturalIdsTest` replay the shared JSON files.
- `features/sync` makes the server a store product: adapter-jvm comes in as
  a Gradle composite build from `STORE_DIR` (default `../store`); store's SQL
  is copied byte for byte as `V9`, `V10`, `V14`, `V16`; every uuid-keyed user
  table is registered, so a write outside the write path fails. REST writes
  run through `ServerWriteAspect` (one server write per endpoint); endpoints
  that open the write path themselves carry `@OwnWritePath`; jobs use
  `ServerWrites.run(scope)`. Push runs mutations through
  `MutationDispatcher` at their HLC; a `DomainException` rejects one.
  `BaselineJob` logs each account's pre-existing rows once
  (`sync_baseline`); a migration that rewrites synced rows under
  `store.bypass` must clear those accounts' `sync_baseline` rows.
- Auth is an OAuth2 resource server only (`AUTH_ISSUER_URI`,
  `AUTH_AUDIENCE`); users are `user_identity (issuer, subject)` →
  `app_user`. Errors are RFC 9457 problem details with a `kind` matching
  time-core's `Error`.
- After an API change: `./gradlew openApi`, then `pnpm generate:api` and
  `pnpm exec tsc -b` in `apps/shared/client`. `OpenApiDocumentTest` fails
  while the committed document is stale.
- Every write bumps the user's `data_version` and publishes a change event
  over Postgres `LISTEN/NOTIFY` to the user's websockets at
  `/api/v1/realtime`; events only say "refetch".
- Calendars (`features/calendar`): OAuth with PKCE run by the server
  (`/api/v1/calendar/google/connect`, a public `/callback` that finds the
  person by state), `CalendarSyncJob` (advisory lock, claims due accounts,
  every 5 min each, full read daily over −14 d…+60 d, `syncToken` between,
  back-off, `reauth` on a lost grant) behind `CalendarProvider`. Google
  needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `CALENDAR_TOKEN_KEY`
  (base64 of 32 bytes), else it is off; `CALENDAR_PROVIDER=fake` (the
  default in the `dev` profile and tests) serves fixtures and sends consent
  straight to the callback.
- Web and mobile reminders are push (`features/notifications`,
  `ReminderJob` every 20 s, Expo or Web Push). Account-wide preferences are
  one JSON object (`features/preferences`, `PATCH` merges).
