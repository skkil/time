# 0001: Syncing time through store

Status: accepted, 2026-11-08

time syncs every device through [store](../../../store), pinned by
`STORE_VERSION`. The contract is store's `docs/protocol.md`; this record
fixes how time maps onto it.

## Ids

- Every synced entity id is a UUID string (`Id = string` in the contract).
  Ids made on a device come from `MutationContext::next_id()` (derived from
  the client and mutation, so the server reproduces them); ids made by the
  server on its own are random UUIDv7.
- Existing desktop databases are migrated once: every integer id maps to a
  UUIDv7 and every foreign key follows, after a backup.

## Natural keys

A row identified by something other than its id (an upsert keyed by a unique
natural key, or a row the app seeds on its own) never takes a random or
mutation-derived id once the device is bound to a scope: two devices creating
it offline would make two rows. Its id is `UuidV5(scope_id, name)` (RFC 9562
version 5, SHA-1, the scope id as namespace), where `name` is the table, then
each key part, joined by `/`, built only through `NaturalKey`. Uuids are
lowercase canonical strings and dates `yyyy-MM-dd`. Making such a row draws
no id from `MutationContext::next_id()`, so the n-th derived id stays the
same on the device and the server. A device that was never bound has no
scope, so it uses random ids until its first sign-in re-keys them (see First
sign-in), and seeds the default rituals only once bound.

| Table | Natural key | Name |
| --- | --- | --- |
| `setting` | user, key | `setting/<key>` |
| `project_canvas` | project | `project_canvas/<projectId>` |
| `week` | user, Monday | `week/<monday>` |
| `day` | user, date | `day/<date>` |
| `task_dependency` | task, blocker | `task_dependency/<taskId>/<blockedById>` |
| `record_phase` | record task, phase status | `record_phase/<taskId>/<statusId>` |
| `running_timer` | user (one per account) | `running_timer` |
| `habit_log` | habit, date | `habit_log/<habitId>/<date>` |
| `ritual` | user, kind | `ritual/<kind>` |
| `user_preference` | user (one per account) | `user_preference` |

Example: in scope `x`, the week of 2026-11-02 is
`UuidV5(x, "week/2026-11-02")`. The server builds these in
`common/id/NaturalIds.kt`; its migration `V15` re-keyed existing rows.
`quarter` also has a unique key (user, start date), but it is created
explicitly and its start date can change, so it keeps an ordinary id and a
second offline create is rejected as a conflict.

## Mutations

- A mutation is a write command. Its `name` is the command's contract name
  (`createTask`, `moveTask`, …) and its `args` are the command's parameters as
  a JSON object keyed by the contract's parameter names
  (`{"id": "…", "placement": {…}}`).
- `time-core` (Rust, on every device) and the server (Kotlin) each keep one
  registry from name to the same rule. The server's result is authoritative;
  the device's optimistic result is replaced on the next pull.
- Reads are never mutations. Device-only commands (file pickers, the capture
  hotkey, database export/restore of the local file, ActivityWatch reads) are
  not mutations either.
- A mutation's clock is its HLC (`MutationContext::now()`): "now" and "today"
  are evaluated at the time the user acted, in their time zone, on both sides.

## Ordering

Positions stay dense integers: a new row takes the next position among its
siblings, and lists order by `position`, then `id`, on every side (outcomes
and priorities included). Moves are intents ("put this at index N
among its siblings") replayed by the server on its own state, and every
renumbered row reaches devices through the log, so fractional keys are not
needed while scopes are single-user.

## Shared state

The running timer is one row per account and syncs like any other row
(store's architecture suggests device-local; the product requirement is one
timer everywhere). Device-only state (zoom, layout, ActivityWatch source
data) never syncs.

## Baseline

A device that pulls a scope from version 0 receives only what store's log
holds. The server registered its tables in `V13`, so rows written before it,
and rows `V15` re-keyed under `store.bypass`, were never logged. Each account
is therefore baselined once: one server write that runs store's
`store_capture_existing` over every registered table, filtered to the
account (by `user_id`, or through the parent row for tables without one),
parents before children, so every row reaches the log as an ordinary
upsert. `sync_baseline` records the accounts whose log is complete and the
version that baselined them.

- `BaselineJob` baselines every account without a row when the server
  starts and retries while any remain. An advisory lock per account lets
  several instances run it at once without baselining an account twice.
- Accounts created after `V17` are recorded at provisioning, with no
  version: their log holds every row from the first.
- A restore replaces the account's rows in one logged server write, then
  bumps the scope's epoch (`store_bump_epoch`) and baselines again in the
  same transaction. Every device resets and pulls from version 0 onto the
  restored rows; device mutations still pending are kept and replayed, and
  those naming ids the restore replaced are rejected.
- A future migration that rewrites synced rows under `store.bypass` must
  delete their accounts' `sync_baseline` rows, so the job captures them
  again.

## Offline everywhere

Desktop, web and mobile all run `time-core` over a local SQLite replica with
store-core: desktop natively, web as WASM with SQLite on OPFS, mobile through
uniffi-bindgen-react-native. The shared UI talks to it through the same
`Backend` port. Signing in turns sync on; a signed-out desktop stays fully
local.

## The sync facade

`time_core::sync::Engine` is the one entry point every host uses (desktop
natively, web over WASM, mobile over uniffi). It owns the connection,
registers every table in `data::SYNCED_TABLES` by `id`, and exposes
`mutate`, `query`, the typed and byte push/pull functions, `status_json`,
`issues`, `dismiss_issue`, `retry_issue`, `sign_in`/`keep_local`/`start_fresh` (which
wrap `bind_scope`) and `forget`. Device-only state lives outside the synced
tables: `device_setting` (capture hotkey, sync server config, a staged
upload) and store's own tables.

## Signed out

A device that has never signed in writes straight to SQLite with no store
capture, so a local-only desktop grows no queue it may never push. Once a
device has been bound to an account, every write is captured, even while
signed out, and waits for that account.

## First sign-in

Every device learns the account's scope from `scopeId` in `GET /api/v1/me`
after the OIDC sign-in (desktop: a public client with PKCE and a loopback
redirect; see `docs/deployment.md`).

`sign_in(scope)` returns `Synced` (already this account), `Uploading`
(first sign-in) or `OtherAccount` (bound to another scope; nothing happens
until the user picks `keep_local` or `start_fresh`). Uploading:

1. `data::dump` copies every synced row (default rituals left out) into
   `device_setting.sync_upload`. When the device was bound to another
   account (`keep_local`), every row first takes a new id and every
   reference follows (`LocalData::with_new_ids`): that account still owns
   the old ids, and the server refuses to overwrite another account's rows.
2. `forget`, `bind_scope(scope)`, then the account's default rituals are
   seeded with their scope-derived ids outside capture.
3. One `importLocal` mutation (`{"data": {"tables": [{"table", "rows"}]}}`,
   natural-key rows re-keyed for the account) upserts everything. Its
   pre-image is empty, so a pull replaces it cleanly with the server's echo.
4. The staged copy is removed. A crash before that re-runs the upload on
   the next open.

`importLocal` is listed under `syncMutations` in `commands.json`: a
mutation with no contract command, which both registries implement
(`time_core::data::import`, the server's `LocalImportService`) with the same
rules. Store applies it once like any mutation, and the server's capture
logs every row it writes.

- Rows are SQLite-shaped: column names as in the tables, booleans as `0`/`1`
  or `true`/`false`, dates `yyyy-MM-dd`. Tables go in `SYNCED_TABLES` order
  and a table's rows parents first. A table that doesn't sync (including
  the server's own `user_preference`) is refused, and so is a row without a
  uuid `id`. Columns the receiver doesn't keep are ignored; `user_id` is
  never read from a row. The server also refuses a value of the wrong type.
- A natural-key row takes its key's id in the account, whatever id it
  arrived with (the device sends it already re-keyed).
- A row whose id another account owns is refused (`conflict`, "That id is
  already taken."). A row whose id the account has takes the uploaded
  values.
- Otherwise, a row whose natural key another of the account's rows holds
  merges into that row: it keeps the account's id, takes the uploaded
  values, and every later uploaded reference to the uploaded id follows
  it. The keys (`NATURAL_KEYS` in `data/tables.rs`, `LocalTables.kt`) are
  the natural-key tables above plus a group's name (ignoring case), a
  quarter's start date and the `external_id` of imported projects,
  sections and tasks. Without this, an account that already had the
  device's quarter or group would reject the whole upload and the device
  would lose the rows it had just forgotten.
- Anything else is inserted with the id the device chose.
- Every reference must name a row of the account, uploaded or already
  there; a dangling or foreign one is refused (`invalid`, "A task row
  points at a project that isn't there.").

So on an account that already has data, uploaded values win for rows they
share (the same day's note, a customised ritual, a setting, the running
timer) and everything else is added. These rules only refuse what can't be
merged safely; a refused upload is not lost (see Refused changes).

## Refused changes

When the server rejects a mutation, store-core undoes it on the device and
keeps an issue with the mutation's name, its full arguments and the
server's reason. Settings → Sync lists them (mobile: Couldn't sync) with
two actions:

- **Try again**: `Engine::retry_issue(id)` runs store's `mutate` with the
  stored name and arguments through `TimeMutator`, so the change is applied
  locally again and queued as a new mutation (new id and clock; ids it
  derives are drawn afresh, rows that carry their own ids, like
  `importLocal`'s, keep them). The issue is dismissed once it is queued; if
  the mutation fails locally, the issue stays and the error is returned.
  If the server refuses it again, a new issue appears.
- **Dismiss** drops the issue and with it the only copy of the change. For
  `importLocal`, which carries every row the device had before its first
  sign-in, the UI asks first.

Every host exposes it: the desktop `retry_sync_issue` command,
`retryIssue` in core-wasm (through the web worker) and core-native, and
`Platform.sync.retryIssue`.

## Cross-language checks

Three files under `apps/shared/contract/src` keep the two registries in
step; the Rust and Kotlin tests both read them:

- `commands.json`: every command's category. `MutationCoverageTest` fails on
  a category it doesn't know, and the server registers exactly
  `mutations` plus `syncMutations`.
- `natural-keys.json`: `(kind, scope, parts) → name → id` vectors for every
  natural key above, computed with Python's `uuid.uuid5`.
- `mutation-vectors.json`: an ordered run of mutations (36 steps over 32 of
  the 97 mutations, `importLocal` included) with fixed clocks and ids in a
  fixed scope, each followed by the rows it must leave. Both sides replay it
  from an empty account, so a rule, an id draw or a natural id that differs
  fails the build. Extend it when a mutation changes.

Both registries accept `0`/`1` wherever a mutation argument is a boolean,
at any depth (`SqliteBooleans` on the server, `mutations::booleans` in
time-core), since SQLite devices may send either.

## Mobile

- `apps/core-native` (crate `time-core-native`) exports one uniffi object,
  `TimeCore`, over the `Engine`: `open(path)`, `mutate`/`query` (JSON text),
  the `CoreHandle` byte functions (`pushRequest`, `applyPushResponse`,
  `pullRequest`, `applyPullResponse`, `status`), `bindScope` (the engine's
  `sign_in`), `keepLocal`, `startFresh`, `forget`, `issues`,
  `dismissIssue` and `retryIssue`. Errors keep the desktop `{kind, message}` shape.
  uniffi-bindgen-react-native turns it into the Turbo Module
  `@skkil-time/core-native`; its generated bindings are committed, the
  static libraries are built (`cargo-ndk`, NDK 30; Xcode for iOS).
- The engine lives on one Rust thread that runs jobs in order. Commands and
  account steps are async futures that wait on that thread, so the JS
  thread never waits for SQLite and writes keep their order. The
  `CoreHandle` calls block, because store's TypeScript driver calls them
  synchronously; each builds or applies one page (100 mutations, 500
  versions).
- The app drives sync with `@skkil/store-client` and `expo/fetch` (React
  Native's own fetch can't stream Pokes). The first sync token also tells
  the app where store and Push live, so the driver starts once the server
  is reachable; until then the phone keeps working locally.
- The phone is bound on sign-in to the scope from `/me` `scopeId`, through
  `@skkil-time/sync` as on web. Another account's rows ask Keep this data
  (`keepLocal`) or Use the account's data (`startFresh`), as on desktop and
  web. The app always needs an account, so signing out on purpose
  calls `forget`; a sign-in that lapses on its own keeps the replica for
  the next one.

## The web replica

The browser runs `time-core-wasm` (`apps/web/engine`) in a dedicated Web
Worker per tab, with SQLite on OPFS through the sync-access-handle pool
VFS (no cross-origin isolation needed, no WAL). The pool holds its files
exclusively, so one worker per origin owns the database: whoever holds
the Web Lock `skkil-time-engine` (store client's `webLock`). It runs
`@skkil/store-client`'s driver with `noopLock`; the other tabs' workers
relay their calls to it over a BroadcastChannel and take over, in lock
order, when it goes away. A call in flight during a hand-over is sent
again if it is a read and fails if it is a write, so no mutation can run
twice.

Signing in binds the replica as `sign_in` does on desktop. Signing out of
a browser calls `forget` (after a last sync, and after asking when changes
are still waiting), because a browser is often shared; desktop keeps its
data. A web backup is time-core's JSON dump, and a restore is one
`importLocal` mutation, so it merges rows back and reaches every device.
Browsers without OPFS use the online-only remote backend.

## Undo

`captureTasks` is a read that returns the `TaskSnapshot` payload (rows as
`{table, columns, values}` with JSON booleans) and the UI keeps it in
memory; `restoreTasks(snapshot)` is a mutation every device replays.
`deleteAllData` is a mutation too.
