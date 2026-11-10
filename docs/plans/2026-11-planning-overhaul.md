# Planning overhaul: moving overdue work, a simpler project page, the plan in view, Google Calendar

Status: plan, ready to build · Written 2026-11-10 · Owner of decisions: the user

**Bottom line.** Six workstreams:
- **A.** Overdue work moves to a new day, week or Someday without guilt, and
  its focus blocks move with it. Blocks that end log themselves as tracked time.
- **B.** The project page drops its Todoist-clone setup sprawl and puts settings
  in one place.
- **C.** Notifications are scheduled on mobile devices; every kind can be
  switched off in Settings.
- **D.** A tray or menu bar on desktop and home-screen widgets on mobile keep
  today's plan in view.
- **E.** Google Calendar events show on Day and Week.
- **F.** The evening checkout becomes the weekly checkout on the user's review day.

A, B and F are mostly `time-core` and UI work; C–E add native and server
surfaces. The build order is at the end.

Every phase below can be picked up by an agent without further context. Read
`AGENTS.md` first. Its "Change once, reach every app" rule and the new-command
checklist apply to every new mutation listed here.

---

## 0. Why (evidence)

On 2026-11-10 we read about 5,000 Hacker News comments in 15 threads `[secondary: HN Algolia API, 2026-11-10]`, plus
Reddit content and forum and blog posts reached through web search. The Reddit
material came from search snippets only.

| Finding | Strength | Workstream |
|---|---|---|
| Red overdue lists and growing backlogs make people stop opening the app ("emotional repulsion field", "dread"). Common fixes: declare bankruptcy, now/soon/later lists, roll unfinished items forward. | Strongest theme; ~40 comments in one thread alone `[secondary, read 2026-11-10: HN 44864134, 31471127, 36276053]` | A |
| Fuzzy dates are wanted: "temporal but flexible" tasks; apps that force a single day frustrate people. | Several comments `[secondary, read 2026-11-10: HN 36276053, 49894805]` | A |
| Configuring the system becomes the work: Notion "database monster", custom columns as overhead. | ~40 comments `[secondary, read 2026-11-10: HN 35698521; r/Notion snippets]` | B |
| People forget to open the app; the plan has to be visible (homepage, desk, paper) and push a few loud alerts. | ~35 comments `[secondary, read 2026-11-10: HN 44864134, 13855577]` | C, D |
| Tasks and calendar are split; Todoist dropped two-way Google Calendar sync (2025-03-10); asking for full Google Calendar access during onboarding made people bail. | ~30 comments + Todoist help page `[secondary]` | E |
| People forget to start timers, so time tracking dies; they want entries filled in automatically. | ~12 comments, thin `[secondary]` | A4 |

The user reports the same overdue and setup pain on their own data
`[primary: user, 2026-11-10]`.

---

## Global constraints (all phases)

- **Never edit a shipped migration.** New core migrations start at `021_`
  (`apps/shared/core/src/db/migrations/`, latest is `020_review_position.sql`).
  New server Flyway migrations start at `V18__` (latest is `V17__sync_baseline.sql`).
  The migration numbers in this plan are placeholders. Phases ship in a
  different order, so always take the next free number.
- **Every new synced write** needs all of these:
  - the time-core function
  - an arm in `mutations/apply.rs`
  - a `MUTATIONS` entry in `mutations/catalog.rs`
  - a `commands.json` entry
  - a Tauri wrapper in `apps/desktop/src-tauri/src/commands/`
  - a Kotlin `MutationSet` entry and endpoint
  - a line in `apps/shared/client/src/server/*.ts`
  - steps in `mutation-vectors.json`

  Then run `pnpm generate` in `apps/shared/client`. `tsc` there fails until all of these agree.
- New synced tables go in `data/tables.rs` (`SYNCED_TABLES`, the FK list) and
  in the server's sync registration. Every server query filters by `user_id`.
- Use `caller.now()` and `caller.today()` on the server, and `MutationEnv` in core.
  Never read the wall clock inside a write.
- UI copy says "this device", never a platform noun. Destructive and scheduling
  changes call `offerUndo`. Read time positions through `useTimeScale`.
- Follow the user's design notes: plain, conventional UI on the Projects page
  (labelled buttons, underline tabs, a breadcrumb with the title row); calm
  colours (glass, no harsh red). Verify UI changes with headless screenshots
  against a mocked Tauri `invoke` before calling a phase done.
- No code comments. Commit after each landed phase, with no co-author trailer.
- Run after every phase: `skkil ci`. Run it per task while iterating:
  - `cd apps/shared/core && cargo test && cargo clippy --all-targets --features specta -- -D warnings`
  - `cd apps/desktop/src-tauri && cargo test`, which also rewrites `bindings.ts`
  - `cd apps/server && ./gradlew spotlessApply test`
  - `pnpm lint && pnpm compile && pnpm test` at the repo root
- If a build fails for reasons outside your change, another agent may be
  working in the tree. Report it and skip rather than "fixing" their code.

---

## Workstream A: move overdue work without guilt, and keep its focus blocks

### Current state (verified 2026-11-10)

- "Overdue" exists only in TypeScript:
  - `apps/shared/rules/src/due.ts:41` `isOverdue`
  - `day.ts:17` `earlierTasks`
  - It is shown in red: `features/tasks/meta.ts:25` → `text-p1`, `DueText.tsx:19`,
    `fields.tsx:302`, `planner/TaskRail.tsx:63` (`text-attention`), and mobile `TaskRow.tsx:67`.
- `tasks::reschedule` (`apps/shared/core/src/tasks/service.rs:91-114`):
  - increments `rollover_count` when the old date ≤ today and the new date is later
  - keeps `must_on` only when it equals the new date
  - does **not** touch blocks
- `DuePicker` (`features/tasks/fields.tsx:123-131`) saves through `updateTask`.
  That path skips the rollover count, the must clean-up and snapshot undo. This is a bug.
- Time blocks (`blocks/`, table `time_block`) are separate rows. Moving a task's
  date leaves its blocks where they were, and completing a task leaves them too.
- Triage UI: `features/day/Leftovers.tsx`. It is used by:
  - the "N tasks from earlier days" link on Day (`DayCanvas.tsx:149`)
  - the `leftovers` ritual step (`rituals/steps.tsx:206`)
  - the weekly review's Clear the deck step (`review/ClearDeck.tsx`)
- Mobile: `today/EarlierScreen.tsx`, with no undo and no block awareness.
- Bug: `planDay`'s `earlier` list is not filtered by blocks. A past-due task with
  a block today shows up twice.

### Decisions (defaults; the user can override)

1. **"Keep the focus blocks"** means that when a task moves to another date, its
   future, unfinished blocks move with it. They keep their time of day and
   length and shift by the same number of days as the due date. Past blocks stay
   where they are as history. `[assumption: user's "while remaining the focus
   blocks"]`
2. Moving to a **week** gives the task a date window (Mon–Sun). Its future
   blocks shift by whole weeks, so they keep their weekday and time.
3. Moving to **Someday** removes the task's future blocks. The task no longer has
   a plan; undo restores the blocks, because the snapshot already copies `time_block`.
4. A task in a window is **not overdue until the window ends**. Overdue copy
   becomes neutral: the group is called "From earlier days", with no red and no
   badge count. Red is kept only for a passed **deadline**, because a deadline is a
   real external date.
5. **No silent automation.** Stale tasks are suggested for Someday, never moved
   without a tap.

### A1. Date windows (`due_until`)

**Objective:** a task can be dated "this week", "next week" or "Fri–Tue".

Data:
- Migration `021_due_window.sql`:
  `ALTER TABLE task ADD COLUMN due_until TEXT NULL` (yyyy-MM-dd).
- Server `V18__due_window.sql`: same column, on the server's task table.
- Invariants, checked in `tasks/rules.rs` and mirrored in Kotlin `TaskRules`:
  - `due_until` requires `due_date`
  - `due_until > due_date`
  - a window is at most 31 days
  - a task with a window has no `due_time` and no `recurrence`

Rules:
- `tasks::reschedule` and `update` clear `due_until` whenever `due_date` is set
  to a single day.
- Rollover is counted against `coalesce(due_until, due_date)`.

TypeScript:
- `rules/src/due.ts`:
  - `isOverdue` and `dueTone` use `dueUntil ?? dueDate`
  - add `formatDue` output "This week", "Next week" and "Fri 14 – Tue 18"
  - add `inWindow(task, date)`
- `rules/src/day.ts`:
  - `planDay` lists windowed tasks under a new `thisWeek` group, only when today
    is inside the window and the task has no block today
  - `earlierTasks` excludes tasks whose window has not ended
- Quick Add (`rules/src/quick-add/`): "this week", "next week" and "by friday"
  produce a window. Add one rule-table entry per phrase, with tests.
  - "by friday" means today through Friday.
  - Avoid clashing with the deadline syntax `{…}`.

UI:
- `DuePicker` quick options: Today, Tomorrow, **This week**, **Next week**,
  This weekend, Pick date.
- `DueText` renders windows.
- Mobile: `TaskRow` and the due editor get the same options.

Acceptance:
- [ ] Core tests: create a task, set a window, `reschedule` clears it, and the invariants reject a bad window.
- [ ] `due.test.ts`: a windowed task is not overdue on the window's last day and is overdue the day after.
- [ ] Quick Add vectors for the new phrases pass in TypeScript, Rust and Kotlin, using the shared `repeat-phrases.json`-style fixture pattern (add a `date-phrases` case if one is needed).

### A2. One move command: `moveTasks`

**Objective:** a single write moves tasks to a day, a week or Someday, and moves
their blocks with them.

- Core: `tasks::move_tasks(conn, env, ids, target, blocks)`, where:
  - `target` is one of `Day{date}`, `Week{monday}` or `Someday`
  - `blocks` is `Follow` (the default) or `Leave`

  The rules, in one statement set and with no transaction of its own (the caller holds one):
  1. Set the dates:
     - `Day` sets `due_date`, clears `due_until`, and keeps `due_time` only if the
       task had one and the target is a future date.
     - `Week` sets `due_date = monday` and `due_until = monday + 6`, and clears `due_time`.
     - `Someday` behaves like `set_someday`.
  2. Count rollover exactly as `reschedule` does.
  3. Clear `must_on` unless it equals the new single day.
  4. Move the blocks. With `Follow`, every block with `start_at >= env.now()` and
     task not completed is shifted:
     - `Day`: by `(new_date - old_effective_date)` days
     - `Week`: by whole weeks, `(monday - monday_of(old)) / 7 * 7` days
     - `Someday`: the blocks are deleted

     With `Leave`, nothing happens to them. Blocks for sub-tasks move with their parent.
  5. Repeating tasks: `Day` and `Week` move only the current occurrence (same as
     `reschedule`); `Someday` is refused for repeating tasks (the UI offers Skip).
- Mutation contract: `moveTasks{ids: Id[], target: {kind:"day",date} | {kind:"week",monday} | {kind:"someday"}, blocks?: "follow"|"leave"}`.
  - Classify it as a mutation in `commands.json`.
  - Add a Kotlin `TaskMutations` entry that reuses `TaskService` and `BlockService`
    SQL inside the same server write.
  - Vectors cover four cases: Day with a future block shifted and a past block kept;
    Week; Someday deleting blocks; and the rollover count.
- Keep `rescheduleTasks` for compatibility. In the UI, route every date move
  through `moveTasks`, including `DuePicker`'s quick dates, which fixes the
  `updateTask` bug.
- UI hook: `useMoveTasks` in `features/tasks/api.ts`, built on the
  `withSnapshot`/`offerRestore` pattern from `useRescheduleTasks` (`api.ts:202-235`).
  - Optimistic update mirrors the core: dates, `someday`, `mustOn` and `dueUntil`.
  - Invalidate `keys.blocks(monday)` for both the old and the new week.
  - Toast: "Moved 3 tasks to next week · 2 focus blocks moved · Undo".
- Mobile: `week/hooks.ts` gets `useMoveTasks`, with an undo snackbar.

Acceptance:
- [ ] `cargo test` in core: block shift preserves time of day and length across DST (use a fixed TZ in `FixedClock`), and past blocks are untouched.
- [ ] `MutationVectorsTest` (Kotlin) and `mutations/vectors.rs` replay the new steps with identical rows.
- [ ] Undo after `moveTasks` restores the dates and the original block spans (UI test with the mocked backend).

### A3. Triage: Earlier → Today, Tomorrow, This week, Next week, Pick a date, Someday

**Objective:** one triage component everywhere, neutral in tone, with a
one-tap fresh start.

- `features/day/Leftovers.tsx`, shared by Day, rituals and Clear the deck:
  - Row actions: **Today**, **Tomorrow**, **This week**, **Next week**,
    **Pick date…**, **Someday**, **Drop** (Skip for repeating tasks). All go
    through `moveTasks`.
  - Show the block count per row when the task has future blocks ("2 focus
    blocks"). A small "move blocks too" checkbox defaults to on and maps to `blocks`.
  - Bulk bar: "All N → Today / This week / Someday". Add a
    **"Fresh start"** button that moves all of them to Someday, with an undo
    toast. It replaces nothing else; it is a shortcut.
  - Stale hint: when `rolloverCount >= 3` or the task has been earlier than today
    for more than 14 days, show "moved 3× · park it?" with Someday highlighted.
    Use the same rule as `ClearDeck` (`:20-51`) and move that rule to
    `rules/src/day.ts` as `isStale`.
- Tone:
  - Replace overdue red with the neutral "earlier" style: add an `earlier` token
    in `apps/shared/design/src/colors.ts`, regenerate `tokens.css`, and use it in
    `meta.ts`, `DueText`, `TaskRail` and mobile `TaskRow`.
  - Keep red for passed deadlines only.
- Week view (`planner/ScheduleView.tsx`, `TaskRail.tsx`):
  - Add an **"Earlier"** group at the top of the rail.
  - Dragging a task from the rail or a `DueCard` onto a day **header** calls
    `moveTasks(Day)`.
  - Dropping on a time slot still creates a block (current behaviour), and also
    sets the due date when the task's date is earlier than that day.
- Fix the double listing: `planDay.earlier` excludes tasks that have a block on
  the plan date.
- Mobile `EarlierScreen.tsx`: the same options and stale hint, plus undo.

Acceptance:
- [ ] Rules test: `planDay` no longer lists a blocked task in `earlier`.
- [ ] Headless screenshot of Day with 6 earlier tasks shows no red and the full set of row actions; Week shows the Earlier rail group.
- [ ] Manual check: drag an earlier task onto Thursday's header, and the task plus its blocks land on Thursday.

### A4. Log focus blocks as tracked time automatically

**Objective:** a block that ended with no tracked time becomes a time entry by
itself, so time tracking survives forgetting to start the timer.
`[decision: user, 2026-11-10, "automatic, not really sure"]`

Risk: automatic logging can record time that was never actually worked, which
makes Week and the review untrustworthy. The mitigations below keep it
automatic while making those entries visible and removable in one tap.

- **Data:**
  - Migration `023_time_entry_source.sql` + server `V21__time_entry_source.sql`:
    `ALTER TABLE time_entry ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
    with values `manual | timer | block`.
  - Block entries use a natural-key id, `time_entry/block/<blockId>`. Add it to
    `env::NaturalKey`, `NaturalIds.kt` and `natural-keys.json`, so two devices
    logging the same block converge on one row.
- **Mutation:** `logEndedBlocks{until: Timestamp}` (synced). It creates an entry
  for every block that:
  - ended at or before `until`, on the current or previous day
  - has no overlapping `time_entry` for the same task
  - has no running timer on its task
  - belongs to a task that is not someday-parked

  A block partly covered by tracked time logs only the uncovered minutes;
  otherwise it is skipped. Add vectors.
- **When it runs:**
  - desktop: the reminders loop, once a minute
  - mobile and web: on foreground and after a sync pull
  - the evening checkout, before its first step
- **Visibility:**
  - Block-sourced entries render with a dashed outline in the Week tracked
    column, with a hover or tap "Logged from plan · Remove".
  - The evening checkout's `what_moved` step lists today's block-sourced
    entries with a one-tap Remove each.
- **Setting:** device-independent synced setting `auto_log_blocks` (default on),
  in Settings → Time tracking.

Acceptance:
- [ ] Core tests: a fully covered block is skipped, partial coverage logs the remainder, and running the mutation twice creates no duplicate.
- [ ] Natural-key vectors pass in Rust and Kotlin.
- [ ] Screenshot of Week shows the dashed block-sourced entries.

---

## Workstream B: rebuild the project page around "a list first"

### Current state (verified)

- `features/tasks/ProjectView.tsx` (551 lines) holds:
  - tabs Tasks/Notes/Focus, kept in component state and not remembered
  - two layout modes:
    - unstructured: List/Board saved as `project.view`
    - structured: saved views saved per device in `lastViews`
  - Graph and Timeline as extra modes in `projectTabs`
  - a toolbar with "Edit view", "New view" and "Completed"
- Settings are split three ways:
  - `ProjectSettingsDialog.tsx` (355 lines), with an **Advanced** disclosure
  - `WorkflowSettings.tsx` (644 lines) nested inside Advanced, which **saves
    immediately** while the rest of the dialog waits for Save
  - `NewProjectDialog.tsx`, which asks for name, colour, parent, group, hours a
    week, target date, stop-if and a **preset** up front
- Archive and Delete exist only in the sidebar row menu (`ProjectNav.tsx:318-346`).
- `outcome` in project settings has no UI.

### Target information architecture

```
Breadcrumb: Group › Parent
Title row:  ● Project name            [Add task]
Meta:       Next: <task> · 12 open · 3h of 5h this week
Tabs:       Tasks   Notes   Focus   Settings
Tasks toolbar: View [List ▾]   Show completed ☐                (left-aligned)
```

1. **New project asks only for a name** (and optionally "Inside" a parent).
   - Colour is auto-assigned from the palette.
   - Everything else moves to the Settings tab.
   - Delete `PresetPicker` from the new-project flow.
2. **Settings becomes a tab** (`/projects/$projectId?tab=settings`), not a dialog.
   Every field autosaves the same way (debounced, undo toast for destructive
   changes). Sections, in order:
   - **General:** name, colour, inside (parent), group (top-level only), status.
   - **Planning:** target date, hours a week, review every, stop if,
     "tasks happen in order". These are plain fields, no Advanced disclosure.
   - **Structure** (collapsed, with a one-line explanation): item types,
     statuses, milestones. Each starts with "Turn on". **Templates** live here as
     "Start from a template…", which applies a preset to an existing project
     (`applyPreset` already exists).
   - **Views:** the list of saved views, with rename and delete.
   - **Archive / Delete project:** labelled buttons, with a confirm on delete.
   - Remove `ProjectSettingsDialog.tsx`. The sidebar "Edit" entry navigates to the tab.
3. **One "View" picker** replaces the two layout modes. Options, in order:
   - List, Board (columns = sections, or status when statuses are on)
   - Timeline
   - Graph (only when a dependency exists)
   - the saved views, then "New view…"

   The choice is remembered per project in one preference key (`projectView`,
   in `lib/preferences.ts`), and the remembered tab goes in the same key.
   `project.view` (list/board) stays in the data model, but the UI only writes
   the preference. Mark `setProjectView` as deprecated in the plan; do not
   delete the mutation, because synced devices may still send it.

   **Deprecated:** `setProjectView` is kept in the registry for older devices.
   The UI no longer calls it; `project.view` is read only as the fallback for a
   project with no remembered view.
4. **Remove** the "Edit view" toolbar button. Editing a saved view is reached
   from the View picker ("Edit this view…").
5. Keep the side context panel (`ProjectContext.tsx`) as it is. It already
   carries Next, This week and Notes.
6. Move `ProjectView.tsx` to `features/projects/` and split it:
   - `ProjectPage.tsx` (header, tabs, routing to tab bodies)
   - `ProjectTasks.tsx` (View picker and bodies)
   - `ProjectSettings.tsx` (the tab)
   - `workflow/StructureSettings.tsx` (renamed from `WorkflowSettings`, without
     the views section)

   Restructure; don't append.

No core, server or mutation changes are needed. This is UI-only, and that keeps
the risk low.

Acceptance:
- [ ] Creating a project needs exactly one field. The new project opens on Tasks / List.
- [ ] Every setting the old dialog exposed is reachable on the Settings tab, and a test lists them so none are lost: name, colour, parent, group, status, target date, hours a week, review, stop if, in order, types, statuses, milestones, milestone label, views, preset, archive, delete.
- [ ] Reloading the app reopens the same tab and view per project.
- [ ] Headless screenshots of the Inbox, a plain project, a structured project and the Settings tab at 1280 and 900 px widths are checked against the conventional-UI note.
- [ ] `pnpm compile`, `pnpm lint` and `pnpm test` pass; no `ProjectSettingsDialog` import remains.

Open question for the user (B): should the default tab for a project with no
open tasks be Notes? Default: no, always Tasks.

---

## Workstream C: notifications people trust (mobile first, then fixes on desktop)

### Current state (verified)

- The only trigger is a timed task at its due minute:
  - core `reminders/mod.rs`
  - desktop `src-tauri/src/reminders.rs` (20 s loop, `notify-rust`)
  - server `features/notifications/job/ReminderJob.kt` (Expo push and Web Push)
- Mobile (`apps/mobile/src/core/notifications/reminders.ts`) only receives remote
  push. That means no offline reminders, sign-in is required, and there is no
  lead time and no actions.
- Desktop fires reminders for **events** too, while the server excludes them.
  Clicking a notification opens the task only on Linux.
- A single synced `reminders_enabled` setting covers every device.

### Decisions

- Mobile **schedules local notifications from its own replica**. The phone works
  offline and stays correct without the server, which keeps the app local-first.
  Server push stays for web and as a fallback for mobile devices that have not
  upgraded.
- **Everything can be turned off in Settings.** Settings → Notifications has:
  - a master switch per device ("Notifications on this device"), replacing the
    single synced `reminders_enabled` behaviour. Keep `reminders_enabled` as the
    account-wide default; a device value overrides it.
  - the per-type toggles below.

  `[decision: user, 2026-11-10]`
- **Few, loud alerts.** Per-type toggles, kept on the device:

  | Kind | Default | Lead time |
  |---|---|---|
  | timed task | on | 0 min |
  | focus block start | on | 0 min |
  | event | on | 10 min |
  | ritual `at_time` | on | — |
  | deadline (9:00 on the day) | off | — |
  | long-running timer (> 2 h) | off | — |

### C1. Shared reminder schedule in time-core

- New `reminders::upcoming(conn, from: Timestamp, to: Timestamp, kinds) -> Vec<Reminder>`.
  - `Reminder{key, kind, at, title, body, task_id?, block_id?, ritual_kind?}`
  - `key` is a stable string such as `"task:<id>:<date> <time>"` or
    `"block:<id>:<start>"`, used for de-duplication.
  - Pure read. It respects `someday`, completed, item kind (events get the
    `event` kind), and `reminders_enabled`.
- Desktop `reminders.rs` uses `upcoming` for the next minute in place of
  `take_due`, keeping `reminded_for` (device-only) for de-duplication by key. This
  fixes the events bug.
- Mirror the selection in Kotlin `ReminderJob` for task and event kinds, so the
  rules match `time-core`. Add a shared fixture in
  `apps/shared/client/src/types/reminder-vectors.json` that both test suites read,
  following the `mutation-vectors.json` pattern.
- Per-type toggles and lead times live in `device_setting` (device-only; add the
  keys to `device_settings`), plus a Settings → Notifications section declared
  with `available(platform)`.

### C2. Mobile local scheduling

- `time-core-native` exposes `upcoming_reminders(from, to)`. Rebuild the
  bindings with `pnpm build:android` / `build:ios`.
- `apps/mobile/src/core/notifications/schedule.ts`:
  - On app start, foreground, every local write and every sync pull, cancel all
    notifications scheduled by the app (tagged with `data.source = "skkil"`).
  - Then schedule the next 48 h, capped at 50 notifications, because iOS keeps at
    most 64 pending.
- Categories and actions (`setNotificationCategoryAsync`):
  - task: **Done**, **Snooze 15 min**
  - block: **Start focus**, **Snooze 10 min**

  Handle actions in `addNotificationResponseReceivedListener`. They write through
  the local engine; Done is `completeTask`, Start focus is the timer start mutation.
- When local scheduling is on, register the push device with
  `scheduling: "local"`:
  - Server: migration `V19__push_device_scheduling.sql`, adding a
    `scheduling TEXT NOT NULL DEFAULT 'remote'` column.
  - `ReminderJob` skips expo devices with `local`, which avoids duplicates.
- Android: create channels `reminders` and `focus`. iOS: request permission at
  the first time-bound action, not at launch.

### C3. Desktop fixes

- Close-to-tray (see D1), so reminders keep firing when the window is closed.
- Make clicking a notification open the task on macOS and Windows. Evaluate
  `tauri-plugin-notification` against `notify-rust`'s macOS and Windows backends.
  Emil decides; record the choice in the PR.

Acceptance:
- [ ] Core and Kotlin both pass `reminder-vectors.json`.
- [ ] On an Android emulator in airplane mode, a task timed 2 minutes ahead fires, and its Done action completes it (manual check, recorded in the PR).
- [ ] With local scheduling, the server sends no Expo push for that device (Kotlin test).
- [ ] Events no longer fire as task reminders on desktop (Rust test).

---

## Workstream D: the plan in view, on desktop and on home screens

### D1. Desktop tray and macOS menu bar

- Enable `tauri = { features = ["tray-icon"] }`, and add capability entries in
  `capabilities/default.json`.
- `src-tauri/src/tray.rs`. The tray menu is rebuilt every 30 s, on
  `data_version` changes and on writes:
  - **Now:** the running timer (task title and elapsed time), or the current block, or "Nothing planned now".
  - **Next:** the next block or timed item today, with its time.
  - **Musts:** up to 3; clicking one completes it.
  - **Earlier: N tasks**, which opens Day with the triage dialog.
  - Start/stop timer, Quick add…, Open skkil time, Quit.
- macOS: set the tray **title** to the timer's elapsed time or the next block
  ("14:00 Write spec"); keep it under 24 characters. Windows and Linux: tooltip only.
- Read everything from a new core read, `today_glance(conn, now) -> Glance`, with
  the fields `now`, `next`, `musts`, `earlier_count` and `timer`. The same struct
  feeds the mobile widgets (D2), so add it to `READS` and `commands.json` as a read.
- Setting: "Keep running in the tray when the window is closed" (device-only,
  default on). Closing the window then hides it instead of quitting.

Acceptance:
- [ ] Rust unit test for `today_glance` with fixed clocks.
- [ ] Manual check on Linux (the user's platform), plus a macOS check if hardware is available; otherwise list it as untested in the PR.

### D2. Mobile home-screen widgets

- **Data path:** widgets never open SQLite. After every local write or pull, the
  app writes `Glance` as JSON into shared storage:
  - iOS: App Group container `group.com.skkil.time`, file `glance.json`
  - Android: `SharedPreferences` / a file read by the widget

  The app then asks the OS to reload the widgets.
- **Widgets (v1):**
  1. **Today:** small and medium sizes. Shows Now, Next and up to 3 musts.
     Tapping opens the app on Day.
  2. **Quick add:** small. Tapping deep-links to the Quick Add window. This
     doubles as a fast-capture fix.
- **Tooling:** use Expo config plugins so `expo prebuild` stays the source of
  truth (`android/` is gitignored; there is no `ios/`). Candidates:
  - iOS: `@bacons/apple-targets`, a WidgetKit target in SwiftUI
  - Android: `react-native-android-widget`

  Emil must confirm they are compatible with Expo SDK 58 / RN 0.88 before work
  starts. If either is incompatible, write a small in-repo config plugin under
  `apps/mobile/plugins/`.
- **Phase 2 (not in v1):** interactive widgets (complete a must through App
  Intents on iOS 17+ or a Glance action), and a Live Activity for the running timer.

Acceptance:
- [ ] `pnpm android` builds with the widget, and the widget shows the same Now, Next and musts as Day after a write (manual check, screenshot in the PR).
- [ ] `pnpm check:ios` passes with the widget target.

---

## Workstream E: Google Calendar

### Decisions

- **Read-only first.** Phase E1 shows Google events on Day and Week. Phase E2
  (optional) writes focus blocks to a dedicated "skkil time" Google calendar so
  other people see the time as busy. Two-way task sync is a non-goal.
- **Sync runs on the server.** It reaches web, mobile and desktop through the
  existing store sync. Tokens never sit on devices, and a server job can use
  Google's incremental `syncToken`. A signed-out desktop has no calendar, which is
  acceptable and should be stated in the UI.
- **Least permission, asked at the moment of use.** Connecting is offered only
  from Settings → Calendars and from an empty Week. It is never part of
  onboarding.
  - E1 scopes: `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
    and `https://www.googleapis.com/auth/calendar.events.readonly`.
  - E2 adds `calendar.app.created`, where available, or else `calendar.events`.
  - These are Google "sensitive" scopes. Before release to anyone beyond test
    users, the OAuth app needs Google verification. Flag this to the user;
    timeline and cost are unknown. `[gap]`

### E1. Read-only overlay

Server, in a new `features/calendar/` (api, service, repository, job, provider):
- **Tables** (`V20__calendar.sql`):
  - `calendar_account` (server-only, not synced): `id`, `user_id`, `provider='google'`,
    `subject`, `email`, `refresh_token_enc`, `access_token_enc`, `expires_at`,
    `status`, `created_at`. Encrypt tokens with a key from config (`CALENDAR_TOKEN_KEY`).
  - `calendar_source` (synced): `id`, `user_id`, `account_id`, `external_id`,
    `name`, `color`, `visible`, `position`.
  - `calendar_event` (synced, written only by the server): `id`, `user_id`,
    `source_id`, `external_id`, `title`, `start_at`, `end_at`, `all_day`,
    `location`, `status`, `updated_at`.
- **Ids:** server-made rows use natural keys so re-imports are idempotent:
  `calendar_source/<accountId>/<calendarId>` and
  `calendar_event/<sourceId>/<eventId>/<originalStart>`. Add them to
  `NaturalIds.kt`, `env::NaturalKey` and `natural-keys.json`.
- **OAuth:** authorization code flow with PKCE, run by the server:
  - `POST /api/v1/calendar/google/connect` returns `{url}`; the state is bound
    to the user and expires in 10 min.
  - `GET /api/v1/calendar/google/callback` stores the tokens, lists the
    calendars and starts the first sync.
  - `DELETE /api/v1/calendar/accounts/{id}` revokes the token and deletes the
    account with its sources and events.
  - Devices open the URL with `platform().openUrl` (desktop and web) or
    `WebBrowser` (mobile).
- **Job:** `CalendarSyncJob`, using the `ReminderJob` advisory-lock pattern.
  - Every 5 min per account, plus on Google push notifications later (not in E1).
  - Fetch with `singleEvents=true` over a window of −14 d to +60 d, using `syncToken`.
  - Write through `ServerWrites.run(scope)`, so rows reach devices through store.
  - Back off on 429/5xx. On `invalid_grant`, mark the account `status='reauth'`.
- **Provider seam:** a `CalendarProvider` interface with a `GoogleCalendarProvider`
  and a `FakeCalendarProvider` for tests and `skkil dev` (fixtures, no network).

Core and devices:
- Migration `022_calendar.sql` mirrors `calendar_source` and `calendar_event`.
  Add both to `SYNCED_TABLES`.
- Reads:
  - `list_calendar_events(from, to)`, which joins the visible sources
  - `list_calendar_sources`
- Mutation: `setCalendarSourceVisible{id, visible}` (synced).
- Devices refuse local writes to `calendar_event`.

UI:
- Week grid: external events render in the left plans column, using the existing
  event style, the source colour and a small "G" marker. They are read-only:
  clicking opens a popover with the title, time, location and "Open in Google
  Calendar", and they cannot be dragged.
- Day canvas: the same events in the timeline.
- The `timeblock` ritual step and new-block placement avoid slots taken by
  external events.
- Settings → Calendars (`available` when the account is signed in):
  - Connect Google
  - a per-calendar visibility toggle
  - Disconnect
  - a re-auth banner when `status='reauth'`
- Mobile: Week and Day render them through `apps/mobile/src/features/week/hooks.ts`.

Acceptance:
- [ ] Kotlin tests with `FakeCalendarProvider`:
  - the first sync inserts events
  - an incremental sync updates or cancels them
  - a revoked account is cleaned up
  - every query filters by `user_id`
- [ ] Natural-key vectors pass in Rust and Kotlin.
- [ ] Headless screenshot: Week shows external events next to blocks without overlap glitches.
- [ ] With `skkil dev`, the fake provider produces events visible on desktop and web after a sync.

### E2. Push focus blocks to Google (optional, after E1 ships)

- Per account, an opt-in "Show my focus blocks on Google Calendar":
  - creates a "skkil time" calendar
  - the server mirrors `time_block` rows as events: create, update and delete
    when blocks change
  - the mapping is kept in `calendar_block_link(block_id, external_id)`
- Never write to the user's other calendars.

---

## Workstream F: the daily checkout becomes the weekly checkout on review day

**Objective:** one evening ritual. On the user's review day (default Sunday,
changeable), the daily checkout continues into the weekly review, so there is
no separate weekly habit to remember. `[decision: user, 2026-11-10]`

The research behind it: the weekly review is the habit people value most and
keep up least, and an extra ritual is one more thing to forget.

### Current state (verify before building)

- Rituals live in `core/src/rituals/`:
  - kinds `morning`, `evening`, `wind_down`, `session`, `weekly`
  - default steps in `rituals/defaults.rs`; evening is `what_moved,leftovers,…`
    with trigger `end_of_day`
  - `due_ritual(event)` decides what opens
- The guided weekly review is a separate route, `/review/$week`:
  - steps: feel, outcomes, clear the deck, one change, plan, and a quarter wrap-up
  - progress in `week.step`, done at `week.reviewed_at`

### Design

- **Setting:** `review_day` (synced setting, `0..6` with Monday = 0 as in ritual
  weekdays; default 6 = Sunday) in Settings → Rituals: "Weekly checkout on
  [Sunday ▾]".
- **On the review day**, the evening ritual, after its daily steps, shows one
  transition screen: "It's Sunday, so let's close the week. About 5 minutes ·
  Start / Later tonight". Start continues into the weekly steps in the same
  overlay. These are the existing review step components, rendered as ritual
  steps:
  1. feel the week
  2. outcomes
  3. clear the deck (the A3 triage with the "Next week" target)
  4. one change
  5. plan next week
  6. quarter wrap-up, only in the last week of a quarter

  Progress still writes `week.step` and `week.reviewed_at`, so `/review/$week`
  and `ReviewDialog` keep working on the same data.
- **"Later tonight"** snoozes the weekly part only, using the existing
  15-minute, once-only snooze rule. If the week is still unreviewed the next
  morning, the morning ritual offers it once ("Close last week? 5 min"), then
  stops asking until the next review day.
- **The standalone `weekly` ritual kind:** turn off its default trigger for new
  and existing users through a Rust code migration in `db/migrate.rs` (rituals
  are synced; use the natural key `ritual/weekly`). Keep the kind so old rows
  stay valid. The manual "Weekly review" entry (route) stays.
- **Mobile:** if the review steps are not yet on mobile, the transition screen
  links to "Open on desktop or web". State this gap in the PR.

### Acceptance

- [ ] Core test: `due_ritual(EndOfDay)` on the review day returns the evening ritual flagged `weekly: true`; on other days, `weekly: false`.
- [ ] Changing `review_day` to Friday moves the weekly part to Friday's checkout.
- [ ] Completing the weekly part sets `week.reviewed_at`; `/review/$week` then shows the week as reviewed.
- [ ] Screenshots of the evening overlay on a review day: the daily steps, the transition, then the clear-the-deck step.

---

## Later (not planned now)

- Habit grace: backfill a missed day, partial credit, a custom day boundary.
- Interactive widgets and a Live Activity for the timer (see D2, phase 2).
- Outlook / CalDAV providers behind `CalendarProvider`.

## Build order and size

Sizes are T-shirt guesses `[assumption]` until Emil estimates them.

| Order | Phase | Size | Depends on |
|---|---|---|---|
| 1 | A2 `moveTasks` + A3 triage (without windows) | M | — |
| 2 | A1 date windows, then A3's This week / Next week | M | A2 |
| 3 | B project page | M | — (can run in parallel with A) |
| 4 | A4 auto-log blocks as time | M | A2 |
| 4b | F weekly checkout in the evening ritual | M | A3 (triage component) |
| 5 | C1 shared reminders + C3 desktop fixes | M | — |
| 6 | D1 tray / menu bar | S–M | C1 (`today_glance`) |
| 7 | C2 mobile local notifications | M | C1 |
| 8 | D2 mobile widgets | L | D1's `today_glance`, native tooling check |
| 9 | E1 Google read-only | L | Google OAuth app setup |
| 10 | E2 push blocks | M | E1 |

## Open questions for the user

1. A2: when a task moves to Someday, should its future focus blocks be deleted
   (default) or kept on the calendar as unlinked time?
2. A3: should "Fresh start" also appear in the morning ritual, or only on Day and in Clear the deck?
3. E: is a server-side Google sync acceptable, with OAuth tokens stored
   encrypted on the server? The alternative is a device-side sync on desktop only.
4. E: who owns the Google Cloud project and OAuth consent screen, including
   verification for sensitive scopes?

## How we'll know it worked

- Earlier tasks on Day stay under 10 most mornings, and the share of tasks moved
  3 or more times falls month over month. `[measured: user's own DB, compare
  rollover_count distribution before and after A ships]`
- The user opens Day less often to check what's next, because the tray and
  widget answer it. `[assumption; ask after 2 weeks]`
- No duplicate reminders across devices in 2 weeks of use. `[measured: user report]`
