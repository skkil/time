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

## Mutations

- A mutation is a write command. Its `name` is the command's contract name
  (`createTask`, `moveTask`, …) and its `args` are the command's parameters as
  a JSON object keyed by the contract's parameter names
  (`{"id": "…", "placement": {…}}`).
- The desktop (Rust `time-core`) and the server (Kotlin) each keep one
  registry from name to the same rule. The server's result is authoritative;
  the device's optimistic result is replaced on the next pull.
- Reads are never mutations. Device-only commands (file pickers, the capture
  hotkey, database export/restore of the local file, ActivityWatch reads) are
  not mutations either.
- A mutation's clock is its HLC (`MutationContext::now()`): "now" and "today"
  are evaluated at the time the user acted, in their time zone, on both sides.

## Ordering

Positions stay dense integers. Moves are intents ("put this at index N
among its siblings") replayed by the server on its own state, and every
renumbered row reaches devices through the log, so fractional keys are not
needed while scopes are single-user.

## Shared state

The running timer is one row per account and syncs like any other row
(store's architecture suggests device-local; the product requirement is one
timer everywhere). Device-only state (zoom, layout, ActivityWatch source
data) never syncs.

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
`issues`, `dismiss_issue`, `sign_in`/`keep_local`/`start_fresh` (which
wrap `bind_scope`) and `forget`. Device-only state lives outside the synced
tables: `device_setting` (capture hotkey, sync server config, a staged
upload) and store's own tables.

## Signed out

A device that has never signed in writes straight to SQLite with no store
capture, so a local-only desktop grows no queue it may never push. Once a
device has been bound to an account, every write is captured, even while
signed out, and waits for that account.

## First sign-in

`sign_in(scope)` returns `Synced` (already this account), `Uploading`
(first sign-in) or `OtherAccount` (bound to another scope; nothing happens
until the user picks `keep_local` or `start_fresh`). Uploading:

1. `data::dump` copies every synced row (default rituals left out) into
   `device_setting.sync_upload`.
2. `forget`, `bind_scope(scope)`, then the account's default rituals are
   seeded with their scope-derived ids outside capture.
3. One `importLocal` mutation (`{"data": {"tables": [{"table", "rows"}]}}`,
   natural-key rows re-keyed for the account) upserts everything. Its
   pre-image is empty, so a pull replaces it cleanly with the server's echo.
4. The staged copy is removed. A crash before that re-runs the upload on
   the next open.

`importLocal` is listed under `syncMutations` in `commands.json`: a
mutation with no contract command, which the server must implement.

## Seeded and natural-key ids

Rows the server and every device can create on their own get ids derived
from the account: `UuidV5(scope_id, "<table>/<key parts joined by />")`,
built only through `NaturalKey` (`ritual/<kind>`, `week/<date>`,
`day/<date>`, `setting/<key>`, `habit_log/<habit>/<date>`,
`project_canvas/<project>`, `record_phase/<record>/<phase>`,
`task_dependency/<task>/<blocked by>`, `running_timer`). Unbound devices
use random ids. Default rituals are seeded only for a bound scope.

## Undo

`captureTasks` is a read that returns the `TaskSnapshot` payload (rows as
`{table, columns, values}` with JSON booleans) and the UI keeps it in
memory; `restoreTasks(snapshot)` is a mutation every device replays.
`deleteAllData` is a mutation too.
