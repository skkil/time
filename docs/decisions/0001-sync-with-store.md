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
