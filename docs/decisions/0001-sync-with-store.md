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
mutation-derived id: two devices creating it offline would make two rows.
Its id is `UuidV5(scope_id, name)` (RFC 9562 version 5, SHA-1, the scope id
as namespace), where `name` is the table, then each key part, joined by `/`.
Uuids are lowercase canonical strings and dates `yyyy-MM-dd`. Making such a
row draws no id from `MutationContext::next_id()`, so the n-th derived id
stays the same on the device and the server.

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
