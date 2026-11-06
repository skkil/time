# web

The desktop UI in the browser, offline-first. It mounts
[`apps/shared/app`](../shared/app) with the local backend from
[`apps/shared/local`](../shared/local) over time-core compiled to WASM
([`apps/core-wasm`](../core-wasm)), keeps the data in SQLite on the Origin
Private File System, and syncs it through store's TypeScript driver
(`@skkil/store-client`). Sign-in is OIDC through
[`apps/shared/auth`](../shared/auth).

```bash
pnpm --filter @skkil-time/core-wasm build   # once, and after Rust changes (needs wasm-bindgen-cli; wasm-opt from binaryen shrinks it when installed)
pnpm dev       # http://localhost:5173, needs the server and the store service (see apps/server)
pnpm test      # worker RPC, relay, sync runner, platform wiring
pnpm build     # dist/
```

`@skkil/store-client` is linked by path from the store checkout
(`../store/modules/client-ts`, pinned by `STORE_VERSION`); build it there
once with `pnpm install && pnpm build`.

## How it runs

- **One worker per tab.** `src/engine/start.ts` starts a dedicated worker
  (`src/engine/worker/entry.ts`); OPFS sync access handles exist only in
  dedicated workers.
- **One owner per origin.** Every worker asks for the Web Lock
  `skkil-time-engine` (store client's `webLock`). The holder opens the
  database with the SAH-pool VFS, which holds the files exclusively, and runs
  store's sync driver (with `noopLock`, since it already leads). The others
  send their calls to it over the BroadcastChannel `skkil-time-engine`
  (`worker/relay.ts`). When the owning tab closes, the next worker in the
  lock queue takes over; calls that were in flight are sent again if they
  are reads and fail with "try again" if they are writes, so nothing runs
  twice.
- **Page ↔ worker.** A small RPC (`engine/protocol.ts`, `engine/client.ts`):
  calls by method name, errors as `{ kind, message }`, events for changed
  rows and sync state, and the worker asks its page for the access token.
- **Sync.** The owning worker's `SyncRunner` gets a sync token from
  `POST /api/v1/sync/token` (its `storeUrl` and `pushUrl` say where Pull,
  Pokes and Push go), retrying with backoff while offline. Pushes carry the
  bearer token. A pull's changed tables, and writes from other tabs,
  refetch the queries (`Platform.onRemoteChange`, topic `sync`). The
  realtime socket stays only for account preferences, which live on the
  server.
- **Accounts.** On start the engine is bound to the signed-in account's
  store scope (`scopeId` from `/api/v1/me`, through `@skkil-time/sync`).
  A database holding another account's data waits for Keep this data or
  Use the account's data, as on desktop and mobile. Signing out syncs what it can, asks before
  dropping unsynced changes, and forgets the account's rows. Whoever signed
  in last can open the app offline or with expired tokens; syncing then
  waits for a new sign-in.
- **Offline start.** `public/sw.js` keeps the app shell: everything listed in
  `shell-files.json` (written at build time by `shell-files.ts`) plus
  `index.html` and `config.js`, network first for pages and cache first for
  hashed assets.
- **No OPFS** (some private windows, old browsers): the app falls back to
  the online-only remote backend (`src/app/start-remote.tsx`) and says so.

The SAH-pool VFS needs no cross-origin isolation, so no COOP/COEP headers.

## Device-only commands

Backups download and upload JSON (time-core's dump; a restore is one
`importLocal` mutation that merges the rows back), CSV imports use a file
input, habits that track a project's time are measured locally, and the
capture hotkey, database-file backups, ActivityWatch and external-change
polling are off (`Platform.features`).

## Configuration

`VITE_API_URL`, `VITE_AUTH_AUTHORITY`, `VITE_AUTH_CLIENT_ID` and
`VITE_AUTH_AUDIENCE` (see `.env.example`). The store URL comes with each
sync token, so the web app needs no setting for it; the store service must
allow the web origin (`STORE_ALLOWED_ORIGINS`), as must the server
(`CORS_ALLOWED_ORIGINS`).

In the container (`docker build -f web/Dockerfile --build-context
store=../store .` from `apps/`), `API_URL`, `AUTH_AUTHORITY`,
`AUTH_CLIENT_ID` and `AUTH_AUDIENCE` are written to `config.js` at start,
so one image serves every environment. The image builds the WASM engine
and store's client from the store checkout.
